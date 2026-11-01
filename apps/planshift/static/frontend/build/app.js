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

  // ../ledgerseal/node_modules/tslib/tslib.es6.mjs
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
  function __rewriteRelativeImportExtension(path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
      return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function(m, tsx, d, ext, cm) {
        return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : d + ext + "." + cm.toLowerCase() + "js";
      });
    }
    return path;
  }
  var extendStatics, __assign, __createBinding, __setModuleDefault, ownKeys, _SuppressedError, tslib_es6_default;
  var init_tslib_es6 = __esm({
    "../ledgerseal/node_modules/tslib/tslib.es6.mjs"() {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/router/targets.js
  var require_targets = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/router/targets.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/errors.js
  var require_errors = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/errors.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.BridgeAPIError = void 0;
      var BridgeAPIError = class extends Error {
      };
      exports.BridgeAPIError = BridgeAPIError;
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/bridge.js
  var require_bridge = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/bridge.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/utils/index.js
  var require_utils = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/utils/index.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/invoke/invoke.js
  var require_invoke = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/invoke/invoke.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/invoke/index.js
  var require_invoke2 = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/invoke/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_invoke(), exports);
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/invoke-endpoint/invoke-endpoint.js
  var require_invoke_endpoint = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/invoke-endpoint/invoke-endpoint.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/invoke-endpoint/invoke-remote.js
  var require_invoke_remote = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/invoke-endpoint/invoke-remote.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/invoke-endpoint/invoke-service.js
  var require_invoke_service = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/invoke-endpoint/invoke-service.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/invoke-endpoint/index.js
  var require_invoke_endpoint2 = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/invoke-endpoint/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_invoke_remote(), exports);
      tslib_1.__exportStar(require_invoke_service(), exports);
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/view/submit.js
  var require_submit = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/view/submit.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/view/close.js
  var require_close = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/view/close.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/view/open.js
  var require_open = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/view/open.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/view/refresh.js
  var require_refresh = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/view/refresh.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/view/createHistory.js
  var require_createHistory = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/view/createHistory.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/i18n/out/constants.js
  var require_constants = __commonJS({
    "../ledgerseal/node_modules/@forge/i18n/out/constants.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/i18n/out/translationsGetter.js
  var require_translationsGetter = __commonJS({
    "../ledgerseal/node_modules/@forge/i18n/out/translationsGetter.js"(exports) {
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

  // ../ledgerseal/node_modules/lodash/isArray.js
  var require_isArray = __commonJS({
    "../ledgerseal/node_modules/lodash/isArray.js"(exports, module) {
      var isArray = Array.isArray;
      module.exports = isArray;
    }
  });

  // ../ledgerseal/node_modules/lodash/_freeGlobal.js
  var require_freeGlobal = __commonJS({
    "../ledgerseal/node_modules/lodash/_freeGlobal.js"(exports, module) {
      var freeGlobal = typeof global == "object" && global && global.Object === Object && global;
      module.exports = freeGlobal;
    }
  });

  // ../ledgerseal/node_modules/lodash/_root.js
  var require_root = __commonJS({
    "../ledgerseal/node_modules/lodash/_root.js"(exports, module) {
      var freeGlobal = require_freeGlobal();
      var freeSelf = typeof self == "object" && self && self.Object === Object && self;
      var root = freeGlobal || freeSelf || Function("return this")();
      module.exports = root;
    }
  });

  // ../ledgerseal/node_modules/lodash/_Symbol.js
  var require_Symbol = __commonJS({
    "../ledgerseal/node_modules/lodash/_Symbol.js"(exports, module) {
      var root = require_root();
      var Symbol2 = root.Symbol;
      module.exports = Symbol2;
    }
  });

  // ../ledgerseal/node_modules/lodash/_getRawTag.js
  var require_getRawTag = __commonJS({
    "../ledgerseal/node_modules/lodash/_getRawTag.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_objectToString.js
  var require_objectToString = __commonJS({
    "../ledgerseal/node_modules/lodash/_objectToString.js"(exports, module) {
      var objectProto = Object.prototype;
      var nativeObjectToString = objectProto.toString;
      function objectToString(value) {
        return nativeObjectToString.call(value);
      }
      module.exports = objectToString;
    }
  });

  // ../ledgerseal/node_modules/lodash/_baseGetTag.js
  var require_baseGetTag = __commonJS({
    "../ledgerseal/node_modules/lodash/_baseGetTag.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/isObjectLike.js
  var require_isObjectLike = __commonJS({
    "../ledgerseal/node_modules/lodash/isObjectLike.js"(exports, module) {
      function isObjectLike(value) {
        return value != null && typeof value == "object";
      }
      module.exports = isObjectLike;
    }
  });

  // ../ledgerseal/node_modules/lodash/isSymbol.js
  var require_isSymbol = __commonJS({
    "../ledgerseal/node_modules/lodash/isSymbol.js"(exports, module) {
      var baseGetTag = require_baseGetTag();
      var isObjectLike = require_isObjectLike();
      var symbolTag = "[object Symbol]";
      function isSymbol(value) {
        return typeof value == "symbol" || isObjectLike(value) && baseGetTag(value) == symbolTag;
      }
      module.exports = isSymbol;
    }
  });

  // ../ledgerseal/node_modules/lodash/_isKey.js
  var require_isKey = __commonJS({
    "../ledgerseal/node_modules/lodash/_isKey.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/isObject.js
  var require_isObject = __commonJS({
    "../ledgerseal/node_modules/lodash/isObject.js"(exports, module) {
      function isObject(value) {
        var type = typeof value;
        return value != null && (type == "object" || type == "function");
      }
      module.exports = isObject;
    }
  });

  // ../ledgerseal/node_modules/lodash/isFunction.js
  var require_isFunction = __commonJS({
    "../ledgerseal/node_modules/lodash/isFunction.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_coreJsData.js
  var require_coreJsData = __commonJS({
    "../ledgerseal/node_modules/lodash/_coreJsData.js"(exports, module) {
      var root = require_root();
      var coreJsData = root["__core-js_shared__"];
      module.exports = coreJsData;
    }
  });

  // ../ledgerseal/node_modules/lodash/_isMasked.js
  var require_isMasked = __commonJS({
    "../ledgerseal/node_modules/lodash/_isMasked.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_toSource.js
  var require_toSource = __commonJS({
    "../ledgerseal/node_modules/lodash/_toSource.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_baseIsNative.js
  var require_baseIsNative = __commonJS({
    "../ledgerseal/node_modules/lodash/_baseIsNative.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_getValue.js
  var require_getValue = __commonJS({
    "../ledgerseal/node_modules/lodash/_getValue.js"(exports, module) {
      function getValue(object, key) {
        return object == null ? void 0 : object[key];
      }
      module.exports = getValue;
    }
  });

  // ../ledgerseal/node_modules/lodash/_getNative.js
  var require_getNative = __commonJS({
    "../ledgerseal/node_modules/lodash/_getNative.js"(exports, module) {
      var baseIsNative = require_baseIsNative();
      var getValue = require_getValue();
      function getNative(object, key) {
        var value = getValue(object, key);
        return baseIsNative(value) ? value : void 0;
      }
      module.exports = getNative;
    }
  });

  // ../ledgerseal/node_modules/lodash/_nativeCreate.js
  var require_nativeCreate = __commonJS({
    "../ledgerseal/node_modules/lodash/_nativeCreate.js"(exports, module) {
      var getNative = require_getNative();
      var nativeCreate = getNative(Object, "create");
      module.exports = nativeCreate;
    }
  });

  // ../ledgerseal/node_modules/lodash/_hashClear.js
  var require_hashClear = __commonJS({
    "../ledgerseal/node_modules/lodash/_hashClear.js"(exports, module) {
      var nativeCreate = require_nativeCreate();
      function hashClear() {
        this.__data__ = nativeCreate ? nativeCreate(null) : {};
        this.size = 0;
      }
      module.exports = hashClear;
    }
  });

  // ../ledgerseal/node_modules/lodash/_hashDelete.js
  var require_hashDelete = __commonJS({
    "../ledgerseal/node_modules/lodash/_hashDelete.js"(exports, module) {
      function hashDelete(key) {
        var result = this.has(key) && delete this.__data__[key];
        this.size -= result ? 1 : 0;
        return result;
      }
      module.exports = hashDelete;
    }
  });

  // ../ledgerseal/node_modules/lodash/_hashGet.js
  var require_hashGet = __commonJS({
    "../ledgerseal/node_modules/lodash/_hashGet.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_hashHas.js
  var require_hashHas = __commonJS({
    "../ledgerseal/node_modules/lodash/_hashHas.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_hashSet.js
  var require_hashSet = __commonJS({
    "../ledgerseal/node_modules/lodash/_hashSet.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_Hash.js
  var require_Hash = __commonJS({
    "../ledgerseal/node_modules/lodash/_Hash.js"(exports, module) {
      var hashClear = require_hashClear();
      var hashDelete = require_hashDelete();
      var hashGet = require_hashGet();
      var hashHas = require_hashHas();
      var hashSet = require_hashSet();
      function Hash(entries) {
        var index = -1, length = entries == null ? 0 : entries.length;
        this.clear();
        while (++index < length) {
          var entry = entries[index];
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

  // ../ledgerseal/node_modules/lodash/_listCacheClear.js
  var require_listCacheClear = __commonJS({
    "../ledgerseal/node_modules/lodash/_listCacheClear.js"(exports, module) {
      function listCacheClear() {
        this.__data__ = [];
        this.size = 0;
      }
      module.exports = listCacheClear;
    }
  });

  // ../ledgerseal/node_modules/lodash/eq.js
  var require_eq = __commonJS({
    "../ledgerseal/node_modules/lodash/eq.js"(exports, module) {
      function eq(value, other) {
        return value === other || value !== value && other !== other;
      }
      module.exports = eq;
    }
  });

  // ../ledgerseal/node_modules/lodash/_assocIndexOf.js
  var require_assocIndexOf = __commonJS({
    "../ledgerseal/node_modules/lodash/_assocIndexOf.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_listCacheDelete.js
  var require_listCacheDelete = __commonJS({
    "../ledgerseal/node_modules/lodash/_listCacheDelete.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_listCacheGet.js
  var require_listCacheGet = __commonJS({
    "../ledgerseal/node_modules/lodash/_listCacheGet.js"(exports, module) {
      var assocIndexOf = require_assocIndexOf();
      function listCacheGet(key) {
        var data = this.__data__, index = assocIndexOf(data, key);
        return index < 0 ? void 0 : data[index][1];
      }
      module.exports = listCacheGet;
    }
  });

  // ../ledgerseal/node_modules/lodash/_listCacheHas.js
  var require_listCacheHas = __commonJS({
    "../ledgerseal/node_modules/lodash/_listCacheHas.js"(exports, module) {
      var assocIndexOf = require_assocIndexOf();
      function listCacheHas(key) {
        return assocIndexOf(this.__data__, key) > -1;
      }
      module.exports = listCacheHas;
    }
  });

  // ../ledgerseal/node_modules/lodash/_listCacheSet.js
  var require_listCacheSet = __commonJS({
    "../ledgerseal/node_modules/lodash/_listCacheSet.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_ListCache.js
  var require_ListCache = __commonJS({
    "../ledgerseal/node_modules/lodash/_ListCache.js"(exports, module) {
      var listCacheClear = require_listCacheClear();
      var listCacheDelete = require_listCacheDelete();
      var listCacheGet = require_listCacheGet();
      var listCacheHas = require_listCacheHas();
      var listCacheSet = require_listCacheSet();
      function ListCache(entries) {
        var index = -1, length = entries == null ? 0 : entries.length;
        this.clear();
        while (++index < length) {
          var entry = entries[index];
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

  // ../ledgerseal/node_modules/lodash/_Map.js
  var require_Map = __commonJS({
    "../ledgerseal/node_modules/lodash/_Map.js"(exports, module) {
      var getNative = require_getNative();
      var root = require_root();
      var Map2 = getNative(root, "Map");
      module.exports = Map2;
    }
  });

  // ../ledgerseal/node_modules/lodash/_mapCacheClear.js
  var require_mapCacheClear = __commonJS({
    "../ledgerseal/node_modules/lodash/_mapCacheClear.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_isKeyable.js
  var require_isKeyable = __commonJS({
    "../ledgerseal/node_modules/lodash/_isKeyable.js"(exports, module) {
      function isKeyable(value) {
        var type = typeof value;
        return type == "string" || type == "number" || type == "symbol" || type == "boolean" ? value !== "__proto__" : value === null;
      }
      module.exports = isKeyable;
    }
  });

  // ../ledgerseal/node_modules/lodash/_getMapData.js
  var require_getMapData = __commonJS({
    "../ledgerseal/node_modules/lodash/_getMapData.js"(exports, module) {
      var isKeyable = require_isKeyable();
      function getMapData(map, key) {
        var data = map.__data__;
        return isKeyable(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
      }
      module.exports = getMapData;
    }
  });

  // ../ledgerseal/node_modules/lodash/_mapCacheDelete.js
  var require_mapCacheDelete = __commonJS({
    "../ledgerseal/node_modules/lodash/_mapCacheDelete.js"(exports, module) {
      var getMapData = require_getMapData();
      function mapCacheDelete(key) {
        var result = getMapData(this, key)["delete"](key);
        this.size -= result ? 1 : 0;
        return result;
      }
      module.exports = mapCacheDelete;
    }
  });

  // ../ledgerseal/node_modules/lodash/_mapCacheGet.js
  var require_mapCacheGet = __commonJS({
    "../ledgerseal/node_modules/lodash/_mapCacheGet.js"(exports, module) {
      var getMapData = require_getMapData();
      function mapCacheGet(key) {
        return getMapData(this, key).get(key);
      }
      module.exports = mapCacheGet;
    }
  });

  // ../ledgerseal/node_modules/lodash/_mapCacheHas.js
  var require_mapCacheHas = __commonJS({
    "../ledgerseal/node_modules/lodash/_mapCacheHas.js"(exports, module) {
      var getMapData = require_getMapData();
      function mapCacheHas(key) {
        return getMapData(this, key).has(key);
      }
      module.exports = mapCacheHas;
    }
  });

  // ../ledgerseal/node_modules/lodash/_mapCacheSet.js
  var require_mapCacheSet = __commonJS({
    "../ledgerseal/node_modules/lodash/_mapCacheSet.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_MapCache.js
  var require_MapCache = __commonJS({
    "../ledgerseal/node_modules/lodash/_MapCache.js"(exports, module) {
      var mapCacheClear = require_mapCacheClear();
      var mapCacheDelete = require_mapCacheDelete();
      var mapCacheGet = require_mapCacheGet();
      var mapCacheHas = require_mapCacheHas();
      var mapCacheSet = require_mapCacheSet();
      function MapCache(entries) {
        var index = -1, length = entries == null ? 0 : entries.length;
        this.clear();
        while (++index < length) {
          var entry = entries[index];
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

  // ../ledgerseal/node_modules/lodash/memoize.js
  var require_memoize = __commonJS({
    "../ledgerseal/node_modules/lodash/memoize.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_memoizeCapped.js
  var require_memoizeCapped = __commonJS({
    "../ledgerseal/node_modules/lodash/_memoizeCapped.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_stringToPath.js
  var require_stringToPath = __commonJS({
    "../ledgerseal/node_modules/lodash/_stringToPath.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_arrayMap.js
  var require_arrayMap = __commonJS({
    "../ledgerseal/node_modules/lodash/_arrayMap.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_baseToString.js
  var require_baseToString = __commonJS({
    "../ledgerseal/node_modules/lodash/_baseToString.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/toString.js
  var require_toString = __commonJS({
    "../ledgerseal/node_modules/lodash/toString.js"(exports, module) {
      var baseToString = require_baseToString();
      function toString(value) {
        return value == null ? "" : baseToString(value);
      }
      module.exports = toString;
    }
  });

  // ../ledgerseal/node_modules/lodash/_castPath.js
  var require_castPath = __commonJS({
    "../ledgerseal/node_modules/lodash/_castPath.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_toKey.js
  var require_toKey = __commonJS({
    "../ledgerseal/node_modules/lodash/_toKey.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/_baseGet.js
  var require_baseGet = __commonJS({
    "../ledgerseal/node_modules/lodash/_baseGet.js"(exports, module) {
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

  // ../ledgerseal/node_modules/lodash/get.js
  var require_get = __commonJS({
    "../ledgerseal/node_modules/lodash/get.js"(exports, module) {
      var baseGet = require_baseGet();
      function get(object, path, defaultValue) {
        var result = object == null ? void 0 : baseGet(object, path);
        return result === void 0 ? defaultValue : result;
      }
      module.exports = get;
    }
  });

  // ../ledgerseal/node_modules/@forge/i18n/out/translationValueGetter.js
  var require_translationValueGetter = __commonJS({
    "../ledgerseal/node_modules/@forge/i18n/out/translationValueGetter.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/i18n/out/translator.js
  var require_translator = __commonJS({
    "../ledgerseal/node_modules/@forge/i18n/out/translator.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/i18n/out/ensureLocale.js
  var require_ensureLocale = __commonJS({
    "../ledgerseal/node_modules/@forge/i18n/out/ensureLocale.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/i18n/out/moduleI18nHelper.js
  var require_moduleI18nHelper = __commonJS({
    "../ledgerseal/node_modules/@forge/i18n/out/moduleI18nHelper.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/i18n/out/types.js
  var require_types = __commonJS({
    "../ledgerseal/node_modules/@forge/i18n/out/types.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
    }
  });

  // ../ledgerseal/node_modules/@forge/i18n/out/index.js
  var require_out = __commonJS({
    "../ledgerseal/node_modules/@forge/i18n/out/index.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/view/getContext.js
  var require_getContext = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/view/getContext.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/view/changeWindowTitle.js
  var require_changeWindowTitle = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/view/changeWindowTitle.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/view/theme.js
  var require_theme = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/view/theme.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/utils/blobParser.js
  var require_blobParser = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/utils/blobParser.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/events/serialiseBlob.js
  var require_serialiseBlob = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/events/serialiseBlob.js"(exports) {
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
          const entries = await Promise.all(Object.entries(payload).map(async ([key, value]) => [key, await (0, exports.serialiseBlobsInPayload)(value)]));
          return Object.fromEntries(entries);
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

  // ../ledgerseal/node_modules/@forge/bridge/out/events/events.js
  var require_events = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/events/events.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/view/emitReadyEvent.js
  var require_emitReadyEvent = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/view/emitReadyEvent.js"(exports) {
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

  // ../ledgerseal/node_modules/iframe-resizer/js/iframeResizer.js
  var require_iframeResizer = __commonJS({
    "../ledgerseal/node_modules/iframe-resizer/js/iframeResizer.js"(exports, module) {
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
        function addEventListener(el, evt, func) {
          el.addEventListener(evt, func, false);
        }
        function removeEventListener(el, evt, func) {
          el.removeEventListener(evt, func, false);
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
            function createDestroyObserver(MutationObserver2) {
              if (!iframe.parentNode) {
                return null;
              }
              var destroyObserver2 = new MutationObserver2(function(mutations) {
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
            var MutationObserver = getMutationObserver();
            if (MutationObserver) {
              destroyObserver = createDestroyObserver(MutationObserver);
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
              function isVisible(el) {
                return null !== el.offsetParent;
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
            }, observer = new MutationObserver(mutationObserved);
            observer.observe(target, config);
          }
          var MutationObserver = getMutationObserver();
          if (MutationObserver) {
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

  // ../ledgerseal/node_modules/iframe-resizer/js/iframeResizer.contentWindow.js
  var require_iframeResizer_contentWindow = __commonJS({
    "../ledgerseal/node_modules/iframe-resizer/js/iframeResizer.contentWindow.js"(exports, module) {
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
        function addEventListener(el, evt, func, options2) {
          el.addEventListener(evt, func, passiveSupported ? options2 || {} : false);
        }
        function removeEventListener(el, evt, func) {
          el.removeEventListener(evt, func, false);
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
          function getElementPosition(el) {
            var elPosition = el.getBoundingClientRect(), pagePosition = getPagePosition();
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
            function setupLink(el) {
              function linkClicked(e) {
                e.preventDefault();
                findTarget(this.getAttribute("href"));
              }
              if ("#" !== el.getAttribute("href")) {
                addEventListener(el, "click", linkClicked);
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
            observer = new MutationObserver(mutationObserved);
            log("Create body MutationObserver");
            observer.observe(target2, config);
            return observer;
          }
          var elements = [], MutationObserver = window.MutationObserver || window.WebKitMutationObserver, observer = createMutationObserver();
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
        function getComputedStyle2(prop, el) {
          var retVal = 0;
          el = el || document.body;
          retVal = document.defaultView.getComputedStyle(el, null);
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

  // ../ledgerseal/node_modules/iframe-resizer/index.js
  var require_iframe_resizer = __commonJS({
    "../ledgerseal/node_modules/iframe-resizer/index.js"(exports, module) {
      var iframeResize = require_iframeResizer();
      module.exports = {
        iframeResize,
        iframeResizer: iframeResize,
        // Backwards compatibility
        contentWindow: require_iframeResizer_contentWindow()
      };
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/view/adf-renderer.js
  var require_adf_renderer = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/view/adf-renderer.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/view/onClose.js
  var require_onClose = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/view/onClose.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/view/getFrameDispatch.js
  var require_getFrameDispatch = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/view/getFrameDispatch.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/view/view.js
  var require_view = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/view/view.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/view/index.js
  var require_view2 = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/view/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_view(), exports);
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/router/router.js
  var require_router = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/router/router.js"(exports) {
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
      var navigate = (location) => {
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
        navigate,
        open,
        reload
      };
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/router/index.js
  var require_router2 = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/router/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_router(), exports);
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/modal/modal.js
  var require_modal = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/modal/modal.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/modal/index.js
  var require_modal2 = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/modal/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_modal(), exports);
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/fetch/fetch.js
  var require_fetch = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/fetch/fetch.js"(exports) {
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
          const { body, headers, statusText, status, isAttachment } = await callBridge("fetchRemote", fetchPayload);
          const responseBody = isAttachment ? (0, blobParser_1.base64ToBlob)(body, headers["content-type"]) : body;
          return new Response(responseBody || null, { headers, status, statusText });
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
          const { body, headers, statusText, status, isAttachment } = await callBridge("fetchProduct", fetchPayload);
          const responseBody = isAttachment ? (0, blobParser_1.base64ToBlob)(body, headers["content-type"]) : body;
          return new Response(responseBody || null, { headers, status, statusText });
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

  // ../ledgerseal/node_modules/@forge/bridge/out/fetch/index.js
  var require_fetch2 = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/fetch/index.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/requestTeamworkGraph/index.js
  var require_requestTeamworkGraph = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/requestTeamworkGraph/index.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/flag/flag.js
  var require_flag = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/flag/flag.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.showFlag = void 0;
      var bridge_1 = require_bridge();
      var errors_1 = require_errors();
      var callBridge = (0, bridge_1.getCallBridge)();
      var showFlag = (options) => {
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
      exports.showFlag = showFlag;
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/flag/index.js
  var require_flag2 = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/flag/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.showFlag = void 0;
      var flag_1 = require_flag();
      Object.defineProperty(exports, "showFlag", { enumerable: true, get: function() {
        return flag_1.showFlag;
      } });
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/events/index.js
  var require_events2 = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/events/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_events(), exports);
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/realtime/realtime.js
  var require_realtime = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/realtime/realtime.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/realtime/productContext.js
  var require_productContext = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/realtime/productContext.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/realtime/index.js
  var require_realtime2 = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/realtime/index.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/rovo/open.js
  var require_open2 = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/rovo/open.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/rovo/isEnabled.js
  var require_isEnabled = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/rovo/isEnabled.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/rovo/rovo.js
  var require_rovo = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/rovo/rovo.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/rovo/index.js
  var require_rovo2 = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/rovo/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_rovo(), exports);
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/cookieConsent/getCookieConsentPreferences.js
  var require_getCookieConsentPreferences = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/cookieConsent/getCookieConsentPreferences.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/cookieConsent/index.js
  var require_cookieConsent = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/cookieConsent/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_getCookieConsentPreferences(), exports);
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/i18n/index.js
  var require_i18n = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/i18n/index.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/permissions/permissions.js
  var require_permissions = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/permissions/permissions.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/egress/out/egress/url-parser.js
  var require_url_parser = __commonJS({
    "../ledgerseal/node_modules/@forge/egress/out/egress/url-parser.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/egress/out/egress/utils.js
  var require_utils2 = __commonJS({
    "../ledgerseal/node_modules/@forge/egress/out/egress/utils.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/egress/out/egress/egress-filtering-service.js
  var require_egress_filtering_service = __commonJS({
    "../ledgerseal/node_modules/@forge/egress/out/egress/egress-filtering-service.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/egress/out/egress/index.js
  var require_egress = __commonJS({
    "../ledgerseal/node_modules/@forge/egress/out/egress/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_egress_filtering_service(), exports);
      tslib_1.__exportStar(require_url_parser(), exports);
      tslib_1.__exportStar(require_utils2(), exports);
    }
  });

  // ../ledgerseal/node_modules/@forge/egress/out/index.js
  var require_out2 = __commonJS({
    "../ledgerseal/node_modules/@forge/egress/out/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_egress(), exports);
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/permissions/permissionsUtil.js
  var require_permissionsUtil = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/permissions/permissionsUtil.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/permissions/index.js
  var require_permissions2 = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/permissions/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_permissions(), exports);
      tslib_1.__exportStar(require_permissionsUtil(), exports);
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/object-store/upload.js
  var require_upload = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/object-store/upload.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/object-store/deleteObjects.js
  var require_deleteObjects = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/object-store/deleteObjects.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/object-store/download.js
  var require_download = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/object-store/download.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.download = void 0;
      var invoke_1 = require_invoke2();
      var errors_1 = require_errors();
      var bridge_1 = require_bridge();
      var callBridge = (0, bridge_1.getCallBridge)();
      var download = async ({ functionKey, keys }) => {
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
      exports.download = download;
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/object-store/getMetadata.js
  var require_getMetadata = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/object-store/getMetadata.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/object-store/objectStore.js
  var require_objectStore = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/object-store/objectStore.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/object-store/types.js
  var require_types2 = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/object-store/types.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/object-store/index.js
  var require_object_store = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/object-store/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_objectStore(), exports);
      tslib_1.__exportStar(require_types2(), exports);
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/featureFlags/evaluator.js
  var require_evaluator = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/featureFlags/evaluator.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/featureFlags/initFeatureFlags.js
  var require_initFeatureFlags = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/featureFlags/initFeatureFlags.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/featureFlags/featureFlags.js
  var require_featureFlags = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/featureFlags/featureFlags.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/featureFlags/index.js
  var require_featureFlags2 = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/featureFlags/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      exports.FeatureFlags = void 0;
      var featureFlags_1 = require_featureFlags();
      Object.defineProperty(exports, "FeatureFlags", { enumerable: true, get: function() {
        return featureFlags_1.FeatureFlags;
      } });
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/frontendCustomMetrics/frontendCustomMetrics.js
  var require_frontendCustomMetrics = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/frontendCustomMetrics/frontendCustomMetrics.js"(exports) {
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

  // ../ledgerseal/node_modules/@forge/bridge/out/frontendCustomMetrics/index.js
  var require_frontendCustomMetrics2 = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/frontendCustomMetrics/index.js"(exports) {
      "use strict";
      Object.defineProperty(exports, "__esModule", { value: true });
      var tslib_1 = (init_tslib_es6(), __toCommonJS(tslib_es6_exports));
      tslib_1.__exportStar(require_frontendCustomMetrics(), exports);
    }
  });

  // ../ledgerseal/node_modules/@forge/bridge/out/index.js
  var require_out3 = __commonJS({
    "../ledgerseal/node_modules/@forge/bridge/out/index.js"(exports) {
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

  // src/frontend/bridge.ts
  async function callResolver(fnName, payload = {}) {
    let res;
    try {
      res = await (0, import_bridge.invoke)(fnName, payload);
    } catch (err) {
      console.error("Forge resolver error:", fnName, err);
      res = { ok: false, error: err?.message || "The planner could not reach Jira." };
    }
    if (!fnName.startsWith("get")) {
      const verdict = classifyResult(res);
      if (verdict.failed && verdict.message) showErrorBanner(verdict.message);
    }
    return res;
  }
  function openIssueInNewTab(issueKey) {
    void import_bridge.router.open(`/browse/${encodeURIComponent(issueKey)}`);
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
  function render(value) {
    if (value instanceof SafeHtml) return value.toString();
    if (Array.isArray(value)) return value.map(render).join("");
    return escapeHtml(value);
  }
  function html(strings, ...values) {
    let out = strings[0];
    for (let i = 0; i < values.length; i++) {
      out += render(values[i]) + strings[i + 1];
    }
    return new SafeHtml(out);
  }

  // src/ui/timeline-math.ts
  function deltaWeeksFromPixels(deltaX, weekWidth) {
    const weeks = Math.round(deltaX / weekWidth);
    return weeks === 0 ? 0 : weeks;
  }
  function clampStartIndex(origStartIdx, deltaWeeks, span, weekCount) {
    const maxStart = Math.max(0, weekCount - span);
    return Math.max(0, Math.min(maxStart, origStartIdx + deltaWeeks));
  }
  function spanFromResize(edge, origStartIdx, origSpan, deltaWeeks, weekCount) {
    if (edge === "right") {
      const span = Math.max(1, Math.min(weekCount - origStartIdx, origSpan + deltaWeeks));
      return { startIdx: origStartIdx, span };
    }
    const origEndIdx = Math.min(weekCount - 1, origStartIdx + origSpan - 1);
    const startIdx = Math.max(0, Math.min(origEndIdx, origStartIdx + deltaWeeks));
    return { startIdx, span: Math.max(1, origEndIdx - startIdx + 1) };
  }

  // src/frontend/legacy-planner.js
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
  function formatEffort(hours) {
    return hours > 0 ? `${hours}h` : "Unestimated";
  }
  var currentPlan = null;
  var activeTaskId = null;
  var hoveredTaskId = null;
  var pinnedDependencyTaskId = null;
  var isDraggingBar = false;
  var modalUseRollupProgressFlag = false;
  var columnWidths = { epic: 110, story: 100, task: 260, resource: 130, effort: 65, progress: 65, target: 65, status: 95 };
  var DEFAULT_COLUMN_WIDTHS = { epic: 110, story: 100, task: 260, resource: 130, effort: 65, progress: 65, target: 65, status: 95 };
  var hiddenColumns = /* @__PURE__ */ new Set();
  var ALL_COLUMNS = [
    { key: "epic", label: "Epic", icon: "\u{1F7EA}", defaultWidth: 110, description: "Parent Epic roadmap category" },
    { key: "story", label: "Story", icon: "\u{1F537}", defaultWidth: 100, description: "Issue type (Story, Task, Subtask)" },
    { key: "task", label: "Task", icon: "\u{1F4DD}", defaultWidth: 260, locked: true, description: "Issue key and summary (Required)" },
    { key: "resource", label: "Resource", icon: "\u{1F465}", defaultWidth: 130, description: "Assigned team member" },
    { key: "effort", label: "Hrs", icon: "\u23F1\uFE0F", defaultWidth: 65, description: "Estimated effort in hours" },
    { key: "progress", label: "Progress", icon: "\u{1F4C8}", defaultWidth: 65, description: "Actual completion %" },
    { key: "target", label: "Target", icon: "\u{1F3AF}", defaultWidth: 65, description: "Planned target completion %" },
    { key: "status", label: "Status", icon: "\u{1F3F7}\uFE0F", defaultWidth: 95, description: "Workflow status" }
  ];
  function getVisibleColKeys() {
    return ALL_COLUMNS.map((c) => c.key).filter((k) => !hiddenColumns.has(k));
  }
  var COL_KEYS = ALL_COLUMNS.map((c) => c.key);
  var WEEK_WIDTH = 85;
  var expandedTasks = /* @__PURE__ */ new Set();
  var currentHierarchyView = "all";
  function initApp() {
    initErrorBanner();
    setupEventListeners();
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
    const hierSwitcher = document.getElementById("hierarchySwitcher");
    if (hierSwitcher) {
      hierSwitcher.addEventListener("change", (e) => {
        currentHierarchyView = e.target.value;
        renderTimelineRows();
        setTimeout(renderDependencySvgOverlay, 100);
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
            await callResolver("unscheduleTask", { taskId: data.taskId });
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
        if (e.target === modal) {
          modal.style.display = "none";
        }
      });
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal-backdrop").forEach((modal) => {
          modal.style.display = "none";
        });
        closeAllPopovers();
        if (colPopover) colPopover.style.display = "none";
        if (pinnedDependencyTaskId) {
          pinnedDependencyTaskId = null;
          renderDependencySvgOverlay();
        }
        const inlineRow = document.querySelector(".inline-creation-row");
        if (inlineRow) inlineRow.remove();
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
      if (progPopover2 && progPopover2.style.display === "flex" && !progPopover2.contains(e.target) && !e.target.closest(".td-progress-cell") && !e.target.closest(".quick-progress-btn")) {
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
      if (pinnedDependencyTaskId && !e.target.closest(".gantt-bar")) {
        pinnedDependencyTaskId = null;
        renderDependencySvgOverlay();
      }
    });
    const btnEarlier = document.getElementById("btnScrollEarlier");
    if (btnEarlier) {
      btnEarlier.addEventListener("click", () => {
        const wrapper = document.getElementById("ganttWrapper");
        if (wrapper) wrapper.scrollBy({ left: -(WEEK_WIDTH * 3), behavior: "smooth" });
      });
    }
    const btnLater = document.getElementById("btnScrollLater");
    if (btnLater) {
      btnLater.addEventListener("click", () => {
        const wrapper = document.getElementById("ganttWrapper");
        if (wrapper) wrapper.scrollBy({ left: WEEK_WIDTH * 3, behavior: "smooth" });
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
        if (!activeProgressTaskKey) return;
        await callResolver("updateWbsTask", {
          taskId: activeProgressTaskKey,
          updates: { progress: pct, manualProgress: true }
        });
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
        await callResolver("updateWbsTask", {
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
        if (!activeProgressTaskKey) return;
        await callResolver("updateWbsTask", {
          taskId: activeProgressTaskKey,
          updates: { progress: Math.max(0, Math.min(100, val)), manualProgress: true }
        });
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
        await callResolver("updateWbsTask", {
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
        await callResolver("updateWbsTask", {
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
      renderDependencySvgOverlay();
    });
  }
  var hasInitialScrolledToToday = false;
  var isSyncingGanttScroll = false;
  function syncGanttScrollWidth() {
    const wrapper = document.getElementById("ganttWrapper");
    const topScroll = document.getElementById("ganttTopScrollbar");
    const topInner = document.getElementById("ganttTopScrollbarInner");
    if (!wrapper || !topScroll || !topInner) return;
    topInner.style.width = wrapper.scrollWidth + "px";
    if (!isSyncingGanttScroll) {
      topScroll.scrollLeft = wrapper.scrollLeft;
    }
  }
  function initGanttScrollSync() {
    const wrapper = document.getElementById("ganttWrapper");
    const topScroll = document.getElementById("ganttTopScrollbar");
    if (!wrapper || !topScroll) return;
    topScroll.addEventListener("scroll", () => {
      if (isSyncingGanttScroll) return;
      isSyncingGanttScroll = true;
      wrapper.scrollLeft = topScroll.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingGanttScroll = false;
      });
    });
    wrapper.addEventListener("scroll", () => {
      closeAllPopovers();
      if (isSyncingGanttScroll) return;
      isSyncingGanttScroll = true;
      topScroll.scrollLeft = wrapper.scrollLeft;
      requestAnimationFrame(() => {
        isSyncingGanttScroll = false;
      });
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
    if (!wrapper || !currentPlan || !currentPlan.weeks) return;
    const visibleKeys = getVisibleColKeys();
    let wbsWidth = 0;
    visibleKeys.forEach((k) => {
      wbsWidth += columnWidths[k] || 100;
    });
    const curWkIdx = currentPlan.weeks.findIndex((w) => w.isCurrentWeek);
    const activeIdx = curWkIdx >= 0 ? curWkIdx : Math.floor(currentPlan.weeks.length / 2);
    const todayX = wbsWidth + activeIdx * WEEK_WIDTH;
    const viewportWidth = wrapper.clientWidth;
    const targetScroll = Math.max(0, todayX - viewportWidth / 2 + WEEK_WIDTH / 2);
    wrapper.scrollTo({ left: targetScroll, behavior: "smooth" });
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
      if (e.target.closest(".gantt-bar, .bar-handle, .btn, button, input, select, a, .resizer, .row-drag-handle, .inline-edit-input, .resource-chip-btn, .editable-badge-chip, .epic-link-chip, .th-col-menu-btn, .row-action-btn, .tree-toggle-btn")) {
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
  function switchView(viewName) {
    document.getElementById("timelineViewSection").style.display = viewName === "timeline" ? "flex" : "none";
    document.getElementById("utilizationViewSection").style.display = viewName === "utilization" ? "block" : "none";
    document.getElementById("heatmapViewSection").style.display = viewName === "heatmap" ? "block" : "none";
    if (viewName === "timeline") {
      setTimeout(renderDependencySvgOverlay, 100);
    } else if (viewName === "utilization") {
      renderUtilizationView();
    } else if (viewName === "heatmap") {
      renderHeatmapView();
    }
  }
  function toggleBacklogTray() {
    const tray = document.getElementById("backlogTray");
    tray.classList.toggle("collapsed");
    setTimeout(syncGanttScrollWidth, 250);
    setTimeout(renderDependencySvgOverlay, 250);
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
    onColumnsChanged();
    callResolver("saveColumnWidths", { columnWidths });
  }
  function onColumnsChanged() {
    try {
      if (currentPlan && currentPlan.projectKey) {
        localStorage.setItem("cascadeplan_hidden_cols_" + currentPlan.projectKey, JSON.stringify(Array.from(hiddenColumns)));
      }
    } catch (e) {
    }
    callResolver("saveHiddenColumns", { hiddenColumns: Array.from(hiddenColumns) });
    updateColumnManagerUI();
    renderTimelineHeader();
    renderTimelineRows();
    setTimeout(syncGanttScrollWidth, 50);
    setTimeout(renderDependencySvgOverlay, 100);
  }
  function updateColumnManagerUI() {
    const visibleKeys = getVisibleColKeys();
    const badge = document.getElementById("colCountBadge");
    if (badge) {
      if (hiddenColumns.size > 0) {
        badge.textContent = `${visibleKeys.length}/${ALL_COLUMNS.length} (${hiddenColumns.size} hidden)`;
        badge.classList.add("has-hidden");
      } else {
        badge.textContent = `${visibleKeys.length}/${ALL_COLUMNS.length}`;
        badge.classList.remove("has-hidden");
      }
    }
    const alertBar = document.getElementById("hiddenColsAlertBar");
    const alertText = document.getElementById("hiddenColsText");
    if (alertBar && alertText) {
      if (hiddenColumns.size > 0) {
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
        <label for="col_chk_${col.key}" class="col-option-label" style="cursor:${col.locked ? "default" : "pointer"};">
          <span>${col.icon}</span>
          <span>${col.label}</span>
          ${col.locked ? html`<span class="badge badge-neutral" style="font-size:9px; padding:1px 4px;">Required</span>` : ""}
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
    const menu = document.createElement("div");
    menu.id = "columnHeaderContextMenu";
    menu.className = "column-manager-popover";
    menu.style.width = "190px";
    menu.style.position = "fixed";
    menu.style.left = Math.min(window.innerWidth - 210, e.clientX) + "px";
    menu.style.top = e.clientY + 12 + "px";
    menu.style.zIndex = "1200";
    menu.innerHTML = html`
    <div style="font-weight:700; font-size:11px; color:#626F86; margin-bottom:4px;">Column: ${colLabel}</div>
    <button class="btn btn-outline btn-sm" id="btnHideThisCol" style="text-align:left; justify-content:flex-start; width:100%; font-size:12px; margin-bottom:4px;">
      🚫 Hide "${colLabel}"
    </button>
    <button class="btn btn-subtle btn-sm" id="btnManageAllFromHeader" style="text-align:left; justify-content:flex-start; width:100%; font-size:12px;">
      ⚙ Manage All Columns...
    </button>
  `;
    document.body.appendChild(menu);
    const hideBtn = menu.querySelector("#btnHideThisCol");
    if (hideBtn) {
      hideBtn.addEventListener("click", () => {
        menu.remove();
        toggleColumnVisibility(colKey);
      });
    }
    const manageBtn = menu.querySelector("#btnManageAllFromHeader");
    if (manageBtn) {
      manageBtn.addEventListener("click", () => {
        menu.remove();
        const pop = document.getElementById("columnManagerPopover");
        if (pop) pop.style.display = "flex";
      });
    }
    function onDocClick(ev) {
      if (!menu.contains(ev.target)) {
        menu.remove();
        document.removeEventListener("click", onDocClick);
      }
    }
    setTimeout(() => document.addEventListener("click", onDocClick), 10);
  }
  async function loadProjectPlan() {
    const loader = document.getElementById("plannerLoadingIndicator");
    const errBanner = document.getElementById("plannerErrorBanner");
    if (loader) loader.style.display = "flex";
    if (errBanner) errBanner.style.display = "none";
    const plan = await callResolver("getProjectPlan", {});
    if (loader) loader.style.display = "none";
    if (plan && Array.isArray(plan.tasks)) {
      currentPlan = plan;
      if (plan.columnWidths) {
        columnWidths = { ...columnWidths, ...plan.columnWidths };
      }
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
    } else {
      if (errBanner) {
        errBanner.style.display = "flex";
        const msg = document.getElementById("plannerErrorMsg");
        if (msg) msg.textContent = "Unable to synchronize with Jira. Please verify your connection or click Retry.";
      }
    }
  }
  function renderPlan() {
    if (!currentPlan) return;
    document.getElementById("projectBadge").textContent = `Project: ${currentPlan.projectKey}`;
    document.getElementById("completionBadge").textContent = `Completion: ${currentPlan.overallProjectCompletion}% | Target: ${currentPlan.overallTargetCompletion}%`;
    document.getElementById("backlogCount").textContent = currentPlan.backlogTasks ? currentPlan.backlogTasks.length : 0;
    const curWk = (currentPlan.weeks || []).find((w) => w.isCurrentWeek);
    if (curWk) {
      const el = document.getElementById("legendCurrentWeek");
      if (el) el.textContent = `Current Week (${curWk.weekKey})`;
    }
    if (currentPlan.tasks) {
      currentPlan.tasks.forEach((t) => {
        if (t.isEpic || t.childrenCount || t.subtasks && t.subtasks.length > 0) {
          expandedTasks.add(t.key);
        }
      });
    }
    renderMilestones();
    renderBacklogTray();
    renderTimelineHeader();
    renderTimelineRows();
    setTimeout(syncGanttScrollWidth, 50);
    setTimeout(renderDependencySvgOverlay, 150);
    if (!hasInitialScrolledToToday) {
      hasInitialScrolledToToday = true;
      setTimeout(scrollToToday, 250);
    }
  }
  function renderMilestones() {
    const strip = document.getElementById("milestonesStrip");
    strip.innerHTML = "";
    (currentPlan.milestones || []).forEach((m) => {
      const el = document.createElement("div");
      el.className = "milestone-pill";
      el.innerHTML = html`<span class="milestone-icon">🔷</span><span>${m.title}</span><span style="color:#626F86;">(${m.weekKey})</span>`;
      strip.appendChild(el);
    });
  }
  function renderBacklogTray() {
    const container = document.getElementById("backlogCardsList");
    container.innerHTML = "";
    const backlog = currentPlan.backlogTasks || [];
    if (backlog.length === 0) {
      container.innerHTML = '<div style="color:#626F86; font-size:12px; text-align:center; padding:20px;">No unmapped backlog issues. Drag from timeline to unmap.</div>';
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
      </div>
    `;
      const bKeyLink = card.querySelector(".backlog-key-link");
      if (bKeyLink) {
        bKeyLink.addEventListener("click", (e) => {
          openJiraIssueInNewTab(item.key, e);
        });
      }
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", JSON.stringify({ taskId: item.key, effortHours: item.effortHours }));
      });
      container.appendChild(card);
    });
  }
  function renderTimelineHeader() {
    const tr = document.getElementById("ganttHeaderRow");
    tr.innerHTML = "";
    getVisibleColKeys().forEach((k) => {
      const colDef = ALL_COLUMNS.find((c) => c.key === k) || { label: k, locked: false };
      const th = document.createElement("th");
      th.className = "th-col";
      th.style.width = columnWidths[k] + "px";
      th.style.minWidth = columnWidths[k] + "px";
      th.innerHTML = html`
      <div class="th-content-wrap">
        <span class="th-label-text">${colDef.label}</span>
        ${!colDef.locked ? html`<button class="th-col-menu-btn" data-col-key="${k}" title="Column options (Hide ${colDef.label})">▾</button>` : ""}
      </div>
    `;
      const menuBtn = th.querySelector(".th-col-menu-btn");
      if (menuBtn) {
        menuBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          openColumnHeaderMenu(e, k, colDef.label);
        });
      }
      const resizer = document.createElement("div");
      resizer.className = "resizer";
      setupColumnResizer(resizer, k);
      th.appendChild(resizer);
      tr.appendChild(th);
    });
    currentPlan.weeks.forEach((w, idx) => {
      const th = document.createElement("th");
      th.className = "week-header-cell" + (w.isCurrentWeek ? " current-week" : "");
      th.innerHTML = html`
      <div class="week-date">${w.weekKey}</div>
      <div class="week-sprint">${w.sprintName}</div>
    `;
      tr.appendChild(th);
    });
  }
  function setupColumnResizer(resizer, colKey) {
    resizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = columnWidths[colKey];
      function onMouseMove(moveEvent) {
        const newWidth = Math.max(50, startWidth + (moveEvent.clientX - startX));
        columnWidths[colKey] = newWidth;
        renderTimelineHeader();
        renderTimelineRows();
        syncGanttScrollWidth();
      }
      function onMouseUp() {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        syncGanttScrollWidth();
        callResolver("saveColumnWidths", { columnWidths });
      }
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }
  var activePickerTaskKey = null;
  function getInitials(name) {
    if (!name || name === "Unassigned") return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
      currentContainer.innerHTML = '<div style="width:100%; font-size:10px; font-weight:700; color:#626F86; text-transform:uppercase; margin-bottom:2px;">Assigned Team:</div>';
      assignedResources.forEach((res) => {
        const chip = document.createElement("div");
        chip.className = "resource-current-chip" + (res.isParent ? " is-lead" : "");
        const initials = getInitials(res.name);
        chip.innerHTML = html`
        <span class="resource-option-avatar" style="width:16px; height:16px; font-size:9px;">${initials}</span>
        <span>${res.name}</span>
        <span style="font-size:9px; opacity:0.8;">${res.isParent ? "(Lead)" : ""}</span>
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
    async function syncTaskResources() {
      if (isInlineDraft || !curTask) return;
      const lead = assignedResources.find((r) => r.isParent) || assignedResources[0];
      const primaryName = lead ? lead.name : "Unassigned";
      const primaryAccountId = lead ? lead.accountId || (currentPlan?.availableUsers || []).find((u) => u.displayName === lead.name)?.accountId : "unassigned";
      const contributingList = assignedResources.map((r) => r.name);
      curTask.resource = primaryName;
      curTask.resourceAccountId = primaryAccountId;
      curTask.contributingResources = contributingList;
      await callResolver("updateWbsTask", {
        taskId: curTask.key,
        updates: {
          resource: primaryName,
          resourceAccountId: primaryAccountId,
          contributingResources: contributingList
        }
      });
      renderTimelineRows();
      setTimeout(renderDependencySvgOverlay, 80);
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
        <span style="flex:1;">Unassigned</span>
      `;
        opt.addEventListener("click", (e) => {
          e.stopPropagation();
          clearAllResources();
        });
        listEl.appendChild(opt);
      }
      const users = (currentPlan?.availableUsers || []).filter(
        (u) => u.displayName && u.displayName.toLowerCase().includes(q)
      );
      if (users.length === 0 && q && !"unassigned".includes(q)) {
        listEl.innerHTML = '<div style="padding:10px; font-size:11px; color:#626F86; text-align:center;">No matching team members</div>';
        return;
      }
      users.forEach((u) => {
        const assignedEntry = assignedResources.find((r) => r.name === u.displayName);
        const isAssigned = Boolean(assignedEntry);
        const isLead = assignedEntry?.isParent;
        const opt = document.createElement("div");
        opt.className = "resource-option" + (isAssigned ? " is-selected" : "");
        const initials = getInitials(u.displayName);
        const isPlaceholder = u.isPlaceholder ? html` <span style="font-size:10px; color:#8993A4;">(Placeholder)</span>` : "";
        let badgeHtml = html``;
        if (isAssigned) {
          badgeHtml = isLead ? html`<span class="resource-badge-lead">Lead</span>` : html`<span class="resource-badge-contrib">Contributor</span>`;
        }
        opt.innerHTML = html`
        <input type="checkbox" class="resource-option-checkbox" ${isAssigned ? "checked" : ""} />
        <span class="resource-option-avatar">${initials}</span>
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${u.displayName}${isPlaceholder}</span>
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
        await callResolver("updateWbsTask", {
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
        opt.innerHTML = html`<span style="color:#626F86; font-size:11px;">✕ (None / Standalone Task)</span>`;
        opt.addEventListener("click", async () => {
          popover.style.display = "none";
          if (activePickerTaskKey === "NEW_INLINE_TASK") {
            if (typeof window.__onEpicSelectedForDraft === "function") {
              window.__onEpicSelectedForDraft("", "");
            }
            return;
          }
          await callResolver("updateWbsTask", {
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
        listEl.innerHTML = '<div style="padding:10px; font-size:11px; color:#626F86; text-align:center;">No matching epics</div>';
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
          await callResolver("updateWbsTask", {
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
    titleEl.textContent = `Target: ${task.key}`;
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
    const startIdx = Math.max(0, currentPlan.weeks.findIndex((w) => w.weekKey === defaultStartWk));
    const span = 3;
    const barLeft = startIdx * WEEK_WIDTH + 4;
    const barWidth = Math.max(WEEK_WIDTH - 8, span * WEEK_WIDTH - 8);
    const creationTr = document.createElement("tr");
    creationTr.className = "inline-creation-row";
    let epicDisplay = inheritedEpic ? `\u{1F7EA} ${inheritedEpic}` : "+ Link Epic";
    const visibleKeys = getVisibleColKeys();
    let cellsHtml = html``;
    if (visibleKeys.includes("epic")) {
      cellsHtml = html`${cellsHtml}
      <td class="td-data td-epic-cell" style="width:${columnWidths.epic}px;">
        <span class="epic-link-chip new-task-epic-chip ${inheritedEpic ? "has-epic" : "no-epic"}" title="Choose Epic">${epicDisplay} ▾</span>
      </td>
    `;
    }
    if (visibleKeys.includes("story")) {
      cellsHtml = html`${cellsHtml}<td class="td-data" style="width:${columnWidths.story}px; color:#0052CC; font-weight:700;">🔷 Task</td>`;
    }
    cellsHtml = html`${cellsHtml}
    <td class="td-data td-task-summary" style="width:${columnWidths.task}px;">
      <div style="display:flex; align-items:center; gap:6px; padding-left:14px;">
        <input type="text" class="inline-create-input" placeholder="Type new task summary & press Enter to save..." autocomplete="off" />
        <button class="btn-inline-save">Add</button>
        <button class="btn-inline-cancel" title="Cancel (Esc)">✕</button>
      </div>
    </td>
  `;
    if (visibleKeys.includes("resource")) {
      cellsHtml = html`${cellsHtml}
      <td class="td-data td-resource-cell" style="width:${columnWidths.resource}px;">
        <div class="resource-chip-btn new-task-resource-btn" title="Assign team member">
          <span class="resource-option-avatar">U</span>
          <span class="new-task-resource-name" style="flex:1; overflow:hidden; text-overflow:ellipsis;">Unassigned</span>
          <span style="font-size:10px; color:#626F86;">▾</span>
        </div>
      </td>
    `;
    }
    if (visibleKeys.includes("effort")) {
      cellsHtml = html`${cellsHtml}
      <td class="td-data td-effort-cell" style="width:${columnWidths.effort}px; text-align:center;">
        <input type="number" class="inline-edit-input new-task-hours" style="width:50px; text-align:center;" placeholder="h" min="0" />
      </td>
    `;
    }
    if (visibleKeys.includes("progress")) {
      cellsHtml = html`${cellsHtml}<td class="td-data" style="width:${columnWidths.progress}px; text-align:center; color:#626F86; font-weight:600;">0%</td>`;
    }
    if (visibleKeys.includes("target")) {
      cellsHtml = html`${cellsHtml}<td class="td-data" style="width:${columnWidths.target}px; text-align:center; color:#626F86; font-weight:600;">0%</td>`;
    }
    if (visibleKeys.includes("status")) {
      cellsHtml = html`${cellsHtml}<td class="td-data" style="width:${columnWidths.status}px; text-align:center;"><span class="badge badge-neutral">NOT_STARTED</span></td>`;
    }
    cellsHtml = html`${cellsHtml}
    <td class="timeline-track-cell" colspan="${currentPlan.weeks.length}" style="width:${currentPlan.weeks.length * WEEK_WIDTH}px;">
      <div class="gantt-bar ghost-timeline-bar" style="left:${barLeft}px; width:${barWidth}px;">
        <span>➕ New Task Preview (3 wks)</span>
      </div>
    </td>
  `;
    creationTr.innerHTML = html`${cellsHtml}`;
    rowElement.after(creationTr);
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
        input.style.borderColor = "#DE350B";
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
        const res = await callResolver("createInlineTask", {
          summary,
          epic: selectedEpic || "General",
          epicKey: selectedEpicKey || void 0,
          resource: selectedResource,
          resourceAccountId: selectedAccountId,
          effortHours: hours,
          startWeek: defaultStartWk,
          spanWeeks: 3,
          targetIndex: insertIndex
        });
        if (res && res.success === false) {
          alert(res.error || "Failed to create task in Jira.");
          input.disabled = false;
          saveBtn.disabled = false;
          saveBtn.textContent = "Add";
          isSubmitting = false;
          return;
        }
        await loadProjectPlan();
      } catch (err) {
        alert(err?.message || "Error creating task.");
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
  function renderTimelineRows() {
    const tbody = document.getElementById("ganttBody");
    tbody.innerHTML = "";
    if (!currentPlan.tasks || currentPlan.tasks.length === 0) {
      tbody.innerHTML = html`<tr><td colspan="${getVisibleColKeys().length + currentPlan.weeks.length}" style="text-align:center; padding:30px; color:#626F86;">No scheduled tasks in project. Drag issues from the Backlog Tray or click "+ Add Task / Issue" to schedule.</td></tr>`;
      return;
    }
    const topDropRow = document.createElement("tr");
    topDropRow.className = "drop-target-row";
    topDropRow.innerHTML = html`<td colspan="${getVisibleColKeys().length + currentPlan.weeks.length}">+ Drop here to place task at top of schedule</td>`;
    setupDropTargetRow(topDropRow, 0);
    tbody.appendChild(topDropRow);
    let tasksToRender = currentPlan.tasks;
    if (currentHierarchyView === "epics") {
      tasksToRender = currentPlan.tasks.filter((t) => t.isEpic || t.hierarchyLevel === 1);
    } else if (currentHierarchyView === "stories") {
      tasksToRender = currentPlan.tasks.filter((t) => !t.isEpic && t.hierarchyLevel !== 1);
    }
    tasksToRender.forEach((task, rowIdx) => {
      if (task.isSubtask && task.parentKey && !expandedTasks.has(task.parentKey)) {
        return;
      }
      if (!task.isEpic && task.epicKey && task.epicKey !== task.key && currentPlan.tasks.some((t) => t.key === task.epicKey) && !expandedTasks.has(task.epicKey)) {
        return;
      }
      const isEpic = Boolean(task.isEpic || task.hierarchyLevel === 1);
      const isSub = Boolean(task.isSubtask || task.hierarchyLevel === -1);
      const tr = document.createElement("tr");
      tr.className = "task-row" + (isEpic ? " is-epic-row" : isSub ? " is-subtask" : " is-story-row");
      tr.dataset.taskId = task.key;
      const hasChildren = Boolean(
        task.childrenCount && task.childrenCount > 0 || task.subtasks && task.subtasks.length > 0 || currentPlan.tasks.some((t) => (t.parentKey === task.key || t.parentId === task.id || isEpic && t.epicKey === task.key) && t.key !== task.key)
      );
      let expandToggleHtml = html``;
      if (hasChildren && !isSub) {
        const isExp = expandedTasks.has(task.key);
        expandToggleHtml = html`<button class="tree-toggle-btn" data-parent-key="${task.key}" title="${isExp ? "Collapse children" : "Expand children"}">${isExp ? "\u25BC" : "\u25B6"}</button>`;
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
      <div style="display:flex; align-items:center; width:100%; padding-left:${indentPx}px;">
        <div class="row-insert-affordance" title="Insert task below (Row ${rowIdx + 2})">
          <button class="row-insert-plus-btn" title="Insert new task below">＋</button>
        </div>
        <span class="row-drag-handle" draggable="true" title="Drag to reorder row">⠿</span>
        ${expandToggleHtml}
        ${badgeHtml}
        <a href="${siteUrl}/browse/${task.key}" target="_blank" rel="noopener noreferrer" class="task-key-link" title="Open ${task.key} in native Jira (new tab)">${task.key} ↗</a>
        <span class="task-summary-text" style="cursor:pointer; margin-left:6px; flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="Click or double-click to edit summary">
          : ${task.summary}
        </span>
        <div class="row-action-toolbar">
          <button class="row-action-btn quick-insert-below-btn" title="Insert task below (Row ${rowIdx + 2})">➕ Add below</button>
          <button class="row-action-btn quick-progress-btn" title="Set actual progress">📈 Progress</button>
          <button class="row-action-btn edit-modal-btn" title="Open full detail modal">✏️ Edit</button>
          <button class="row-action-btn quick-subtask-btn" title="Add Jira subtask">↳ Subtask</button>
          <button class="row-action-btn quick-resource-btn" title="Allocate team member">👥 Team</button>
          <button class="row-action-btn open-jira-row-btn" title="Open ${task.key} in native Jira (new tab)">↗ Jira</button>
          <button class="row-action-btn unschedule-row-btn" title="Remove from planner (Move to backlog)">📤 Backlog</button>
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
        if (epicLabel) {
          epicHtml = html`<span class="epic-link-chip has-epic" title="Click to change epic">🟪 ${epicLabel} ▾</span>`;
        } else {
          epicHtml = html`<span class="epic-link-chip no-epic" title="Click to link epic">+ Link Epic</span>`;
        }
      }
      const visibleKeys = getVisibleColKeys();
      let rowColsHtml = html``;
      if (visibleKeys.includes("epic")) {
        rowColsHtml = html`${rowColsHtml}<td class="td-data td-epic-cell" style="width:${columnWidths.epic}px;">${epicHtml}</td>`;
      }
      if (visibleKeys.includes("story")) {
        rowColsHtml = html`${rowColsHtml}<td class="td-data td-story-cell" style="width:${columnWidths.story}px;" title="${task.story || ""}">${task.story || (isEpic ? "Epic" : isSub ? "Subtask" : "Task")}</td>`;
      }
      if (visibleKeys.includes("task")) {
        rowColsHtml = html`${rowColsHtml}<td class="td-data td-task-summary" style="width:${columnWidths.task}px;">${summaryHtml}</td>`;
      }
      if (visibleKeys.includes("resource")) {
        rowColsHtml = html`${rowColsHtml}<td class="td-data td-resource-cell" style="width:${columnWidths.resource}px;"></td>`;
      }
      if (visibleKeys.includes("effort")) {
        rowColsHtml = html`${rowColsHtml}
        <td class="td-data td-effort-cell" style="width:${columnWidths.effort}px; text-align:center; cursor:pointer;" title="Click to edit effort hours">
          <span class="effort-text" style="font-weight:700;">${formatEffort(task.effortHours)}</span>
        </td>
      `;
      }
      if (visibleKeys.includes("progress")) {
        const isProgRollup = isEpic || task.childrenCount && task.childrenCount > 0;
        const progTitle = isProgRollup ? `Actual progress: ${task.progress}% (Rollup from children: click to edit or override)` : `Click to set actual progress (${task.progress}%)`;
        rowColsHtml = html`${rowColsHtml}
        <td class="td-data td-progress-cell" style="width:${columnWidths.progress}px; text-align:center; cursor:pointer;" title="${progTitle}">
          <div class="progress-chip-cell ${task.progress === 100 ? "is-complete" : task.progress > 0 ? "is-active" : "is-zero"}">
            <span class="progress-chip-fill" style="width:${task.progress}%;"></span>
            <span class="progress-chip-text">${task.progress}% ▾</span>
          </div>
        </td>
      `;
      }
      if (visibleKeys.includes("target")) {
        rowColsHtml = html`${rowColsHtml}
        <td class="td-data td-target-cell" style="width:${columnWidths.target}px; text-align:center; cursor:pointer;" title="Click to set target progress (${task.targetProgress}%)">
          <div class="target-chip-cell">
            <span class="target-chip-text">🎯 ${task.targetProgress}% ▾</span>
          </div>
        </td>
      `;
      }
      if (visibleKeys.includes("status")) {
        rowColsHtml = html`${rowColsHtml}
        <td class="td-data td-status-cell" style="width:${columnWidths.status}px; text-align:center;">
          <span class="badge editable-badge-chip ${task.status === "COMPLETED" ? "badge-success" : task.status === "IN_PROGRESS" ? "badge-primary" : "badge-neutral"}" title="Click to change status">
            ${task.status} ▾
          </span>
        </td>
      `;
      }
      tr.innerHTML = html`${rowColsHtml}`;
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
              const bg = aIdx === 0 ? "#DFE1E6" : aIdx === 1 ? "#DEEBFF" : "#EAE6FF";
              const color = aIdx === 0 ? "#172B4D" : aIdx === 1 ? "#0747A6" : "#403294";
              avatarHtml = html`${avatarHtml}<span class="resource-option-avatar" style="background:${bg}; color:${color}; z-index:${10 - aIdx};" title="${res.name}">${initials}</span>`;
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
            <span class="resource-names-wrap" style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${labelText}</span>
            ${isMultiple ? html`<span class="res-count-badge">${contributing.length}</span>` : ""}
            <span style="font-size:10px; color:#626F86;">▾</span>
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
              await callResolver("updateWbsTask", {
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
              await callResolver("updateWbsTask", {
                taskId: task.key,
                updates: { effortHours: val }
              });
              await loadProjectPlan();
            } else {
              effortTd.innerHTML = html`<span class="effort-text" style="font-weight:700;">${formatEffort(origHours)}</span>`;
            }
          }
          input.addEventListener("keydown", (ke) => {
            if (ke.key === "Enter") {
              ke.preventDefault();
              saveInlineEffort();
            } else if (ke.key === "Escape") {
              saved = true;
              effortTd.innerHTML = html`<span class="effort-text" style="font-weight:700;">${formatEffort(origHours)}</span>`;
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
          await callResolver("unscheduleTask", { taskId: task.key });
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
          if (expandedTasks.has(task.key)) {
            expandedTasks.delete(task.key);
          } else {
            expandedTasks.add(task.key);
          }
          renderTimelineRows();
          setTimeout(renderDependencySvgOverlay, 100);
        });
      }
      const dragHandle = tr.querySelector(".row-drag-handle");
      if (dragHandle) {
        dragHandle.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", JSON.stringify({ taskId: task.key, fromReorder: true, origIndex: rowIdx }));
        });
      }
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
        const rect = tr.getBoundingClientRect();
        const isTop = e.clientY - rect.top < rect.height / 2;
        tr.classList.remove("drop-insert-top");
        tr.classList.remove("drop-insert-bottom");
        const dataStr = e.dataTransfer.getData("text/plain");
        if (!dataStr) return;
        try {
          const data = JSON.parse(dataStr);
          const targetIndex = isTop ? rowIdx : rowIdx + 1;
          if (data.fromReorder) {
            await callResolver("reorderWbsTasks", { taskId: data.taskId, targetIndex });
          } else if (data.taskId) {
            const curWk = (currentPlan?.weeks || []).find((w) => w.isCurrentWeek)?.weekKey || currentPlan?.weeks[0]?.weekKey;
            await callResolver("scheduleBacklogTask", {
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
      trackTd.colSpan = currentPlan.weeks.length;
      trackTd.className = "timeline-track-cell";
      trackTd.style.width = currentPlan.weeks.length * WEEK_WIDTH + "px";
      for (let i = 0; i < currentPlan.weeks.length; i++) {
        const dropSlot = document.createElement("div");
        dropSlot.className = "drop-slot";
        dropSlot.style.left = i * WEEK_WIDTH + "px";
        dropSlot.style.width = WEEK_WIDTH + "px";
        dropSlot.dataset.weekKey = currentPlan.weeks[i].weekKey;
        dropSlot.dataset.rowIndex = rowIdx;
        dropSlot.addEventListener("dragover", (e) => {
          e.preventDefault();
          dropSlot.classList.add("drag-over");
          trackTd.classList.add("drag-over-cell");
          if (!dropSlot.querySelector(".drop-slot-badge")) {
            const badge = document.createElement("div");
            badge.className = "drop-slot-badge";
            badge.textContent = `\u{1F4C5} ${currentPlan.weeks[i].weekKey}`;
            dropSlot.appendChild(badge);
          }
        });
        dropSlot.addEventListener("dragleave", () => {
          dropSlot.classList.remove("drag-over");
          trackTd.classList.remove("drag-over-cell");
          const badge = dropSlot.querySelector(".drop-slot-badge");
          if (badge) badge.remove();
        });
        dropSlot.addEventListener("drop", async (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropSlot.classList.remove("drag-over");
          trackTd.classList.remove("drag-over-cell");
          const badge = dropSlot.querySelector(".drop-slot-badge");
          if (badge) badge.remove();
          const dataStr = e.dataTransfer.getData("text/plain");
          if (dataStr) {
            const data = JSON.parse(dataStr);
            if (data.fromReorder) {
              await callResolver("reorderWbsTasks", { taskId: data.taskId, targetIndex: rowIdx });
            } else {
              await callResolver("scheduleBacklogTask", {
                taskId: data.taskId,
                startWeek: currentPlan.weeks[i].weekKey,
                spanWeeks: 3,
                targetIndex: rowIdx
              });
            }
            await loadProjectPlan();
          }
        });
        trackTd.appendChild(dropSlot);
      }
      const currentWkIdx = currentPlan.weeks.findIndex((w) => w.isCurrentWeek);
      const activeTodayIdx = currentWkIdx >= 0 ? currentWkIdx : Math.floor(currentPlan.weeks.length / 2);
      const curWeek = currentPlan.weeks[activeTodayIdx];
      const todayObj = /* @__PURE__ */ new Date();
      const todayFormatted = todayObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      let dayOffsetFraction = 0.5;
      if (curWeek && curWeek.startDate && curWeek.endDate) {
        const startMs = new Date(curWeek.startDate).getTime();
        const endMs = new Date(curWeek.endDate).getTime();
        const nowMs = todayObj.getTime();
        if (nowMs >= startMs && nowMs <= endMs && endMs > startMs) {
          dayOffsetFraction = Math.max(0.1, Math.min(0.9, (nowMs - startMs) / (endMs - startMs)));
        }
      }
      const todayX = activeTodayIdx * WEEK_WIDTH + WEEK_WIDTH * dayOffsetFraction;
      const todayLine = document.createElement("div");
      todayLine.className = "today-line";
      todayLine.style.left = todayX + "px";
      trackTd.appendChild(todayLine);
      if (rowIdx === 0) {
        const flag = document.createElement("div");
        flag.className = "today-flag";
        flag.style.left = todayX + "px";
        flag.textContent = `TODAY (${todayFormatted})`;
        trackTd.appendChild(flag);
      }
      const currentWeekKey = curWeek?.weekKey || "Today";
      const startWeekKey = task.startWeek || currentWeekKey;
      const startIdx = Math.max(0, currentPlan.weeks.findIndex((w) => w.weekKey === startWeekKey));
      const span = task.spanWeeks || 3;
      const barLeft = startIdx * WEEK_WIDTH + 4;
      const barWidth = Math.max(WEEK_WIDTH - 8, span * WEEK_WIDTH - 8);
      const bar = document.createElement("div");
      bar.className = "gantt-bar" + (isEpic ? " is-epic-bar" : isSub ? " is-subtask-bar" : " is-story-bar");
      bar.style.left = barLeft + "px";
      bar.style.width = barWidth + "px";
      bar.dataset.taskId = task.key;
      const isBehind = task.progress < task.targetProgress && task.status !== "COMPLETED";
      let barBaseColor = task.status === "COMPLETED" ? "#36B37E" : isBehind ? "#DE350B" : "#0065FF";
      if (isEpic) {
        barBaseColor = task.status === "COMPLETED" ? "#36B37E" : isBehind ? "#DE350B" : "#6554C0";
      }
      bar.style.background = isEpic ? "#ECE8F6" : "#DFE1E6";
      const actualFillWidth = task.progress / 100 * barWidth;
      const fillActual = document.createElement("div");
      fillActual.className = "gantt-bar-fill-actual" + (task.progress >= 100 ? " is-full" : "");
      fillActual.style.width = actualFillWidth + "px";
      fillActual.style.background = barBaseColor;
      bar.appendChild(fillActual);
      const fillPlanned = document.createElement("div");
      fillPlanned.className = "gantt-bar-fill-planned";
      fillPlanned.style.left = actualFillWidth + "px";
      fillPlanned.style.width = barWidth - actualFillWidth + "px";
      fillPlanned.style.background = isEpic ? "#8777D9" : barBaseColor;
      bar.appendChild(fillPlanned);
      const content = document.createElement("div");
      content.className = "gantt-bar-content";
      const glyph = isEpic ? "\u{1F7EA}" : isSub ? "\u21B3" : "\u{1F537}";
      const rollupSuffix = isEpic && task.childrenCount ? ` [${task.childrenCount} stories]` : "";
      content.textContent = `${glyph} ${task.key} (${task.progress}%)${rollupSuffix}`;
      bar.appendChild(content);
      if (!isEpic) {
        const leftHandle = document.createElement("div");
        leftHandle.className = "bar-handle bar-handle-left";
        setupBarResizeHandle(leftHandle, task, "left");
        bar.appendChild(leftHandle);
        const rightHandle = document.createElement("div");
        rightHandle.className = "bar-handle bar-handle-right";
        setupBarResizeHandle(rightHandle, task, "right");
        bar.appendChild(rightHandle);
        setupBarDrag(bar, task);
      }
      bar.addEventListener("mouseenter", (e) => {
        showTaskTooltip(e, task);
        hoveredTaskId = task.key;
        renderDependencySvgOverlay();
      });
      bar.addEventListener("mouseleave", () => {
        hideTooltip();
        hoveredTaskId = null;
        renderDependencySvgOverlay();
      });
      bar.addEventListener("click", (e) => {
        if (!e.defaultPrevented && !isDraggingBar) {
          if (pinnedDependencyTaskId === task.key) {
            pinnedDependencyTaskId = null;
          } else {
            pinnedDependencyTaskId = task.key;
          }
          renderDependencySvgOverlay();
        }
      });
      bar.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        openTaskDetailModal(task.key);
      });
      bar.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openProgressPicker(bar, task.key);
      });
      trackTd.appendChild(bar);
      tr.appendChild(trackTd);
      tbody.appendChild(tr);
    });
    const btmDropRow = document.createElement("tr");
    btmDropRow.className = "drop-target-row";
    btmDropRow.innerHTML = html`<td colspan="${getVisibleColKeys().length + currentPlan.weeks.length}">+ Drop here to place task at bottom of schedule</td>`;
    setupDropTargetRow(btmDropRow, tasksToRender.length);
    tbody.appendChild(btmDropRow);
    setTimeout(renderDependencySvgOverlay, 50);
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
      rowEl.classList.remove("drag-over");
      const dataStr = e.dataTransfer.getData("text/plain");
      if (dataStr) {
        const data = JSON.parse(dataStr);
        if (data.fromReorder) {
          await callResolver("reorderWbsTasks", { taskId: data.taskId, targetIndex });
        } else {
          const curWk = (currentPlan?.weeks || []).find((w) => w.isCurrentWeek)?.weekKey || currentPlan?.weeks[0]?.weekKey;
          await callResolver("scheduleBacklogTask", {
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
  function setupBarResizeHandle(handle, task, edge) {
    handle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      if (e.button !== 0) return;
      const startX = e.clientX;
      let wasResized = false;
      const origSpan = Math.max(1, task.spanWeeks || 3);
      const origEffort = task.effortHours || 0;
      const origStartIdx = Math.max(0, currentPlan.weeks.findIndex((w) => w.weekKey === (task.startWeek || currentPlan.weeks[0]?.weekKey)));
      const origLeftPx = origStartIdx * WEEK_WIDTH + 4;
      const origWidthPx = Math.max(WEEK_WIDTH - 8, origSpan * WEEK_WIDTH - 8);
      let targetSpan = origSpan;
      let targetStartIdx = origStartIdx;
      const bar = handle.parentElement;
      bar.classList.add("is-dragging-active");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      const contentEl = bar.querySelector(".gantt-bar-content");
      const origContentText = contentEl ? contentEl.textContent : "";
      function onMouseMove(moveEvent) {
        const deltaX = moveEvent.clientX - startX;
        if (Math.abs(deltaX) > 4) {
          wasResized = true;
          isDraggingBar = true;
        }
        const deltaWeeks = deltaWeeksFromPixels(deltaX, WEEK_WIDTH);
        const resized = spanFromResize(edge, origStartIdx, origSpan, deltaWeeks, currentPlan.weeks.length);
        if (edge === "right") {
          targetSpan = resized.span;
          const newWidth = Math.max(WEEK_WIDTH - 8, targetSpan * WEEK_WIDTH - 8);
          bar.style.width = newWidth + "px";
          const fillPlanned = bar.querySelector(".gantt-bar-fill-planned");
          const fillActual = bar.querySelector(".gantt-bar-fill-actual");
          const actualW = (task.progress || 0) / 100 * newWidth;
          if (fillActual) fillActual.style.width = actualW + "px";
          if (fillPlanned) {
            fillPlanned.style.left = actualW + "px";
            fillPlanned.style.width = newWidth - actualW + "px";
          }
        } else if (edge === "left") {
          targetStartIdx = resized.startIdx;
          targetSpan = resized.span;
          const newLeft = targetStartIdx * WEEK_WIDTH + 4;
          const newWidth = Math.max(WEEK_WIDTH - 8, targetSpan * WEEK_WIDTH - 8);
          bar.style.left = newLeft + "px";
          bar.style.width = newWidth + "px";
          const fillPlanned = bar.querySelector(".gantt-bar-fill-planned");
          const fillActual = bar.querySelector(".gantt-bar-fill-actual");
          const actualW = (task.progress || 0) / 100 * newWidth;
          if (fillActual) fillActual.style.width = actualW + "px";
          if (fillPlanned) {
            fillPlanned.style.left = actualW + "px";
            fillPlanned.style.width = newWidth - actualW + "px";
          }
        }
        if (contentEl) {
          const glyph = task.isSubtask ? "\u21B3" : "\u{1F537}";
          contentEl.textContent = `${glyph} ${task.key} (${targetSpan} wks)`;
        }
      }
      async function onMouseUp() {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        bar.classList.remove("is-dragging-active");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setTimeout(() => {
          isDraggingBar = false;
        }, 80);
        if (wasResized && (targetSpan !== origSpan || targetStartIdx !== origStartIdx)) {
          const autoScale = document.getElementById("autoScaleEffortCheckbox")?.checked === true;
          const newStartWeek = currentPlan.weeks[targetStartIdx].weekKey;
          const updates = { startWeek: newStartWeek, spanWeeks: targetSpan };
          if (autoScale && origEffort > 0 && origSpan > 0) {
            updates.effortHours = Math.max(1, Math.round(origEffort / origSpan * targetSpan));
            task.effortHours = updates.effortHours;
          }
          task.startWeek = newStartWeek;
          task.spanWeeks = targetSpan;
          await callResolver("updateWbsTask", { taskId: task.key, updates, expectedVersion: task.version || 0 });
          await loadProjectPlan();
        } else {
          bar.style.left = origLeftPx + "px";
          bar.style.width = origWidthPx + "px";
          if (contentEl) contentEl.textContent = origContentText;
        }
      }
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }
  function setupBarDrag(bar, task) {
    bar.addEventListener("mousedown", (e) => {
      if (e.target.classList.contains("bar-handle") || e.target.tagName === "A" || e.target.tagName === "BUTTON") return;
      if (e.button !== 0) return;
      e.preventDefault();
      const startX = e.clientX;
      let wasMoved = false;
      const span = Math.max(1, task.spanWeeks || 3);
      const origStartIdx = Math.max(0, currentPlan.weeks.findIndex((w) => w.weekKey === (task.startWeek || currentPlan.weeks[0]?.weekKey)));
      const origLeftPx = origStartIdx * WEEK_WIDTH + 4;
      let targetStartIdx = origStartIdx;
      const contentEl = bar.querySelector(".gantt-bar-content");
      const origContentText = contentEl ? contentEl.textContent : "";
      bar.classList.add("is-dragging-active");
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      function onMouseMove(moveEvent) {
        const deltaX = moveEvent.clientX - startX;
        if (Math.abs(deltaX) > 4) {
          wasMoved = true;
          isDraggingBar = true;
        }
        const deltaWeeks = deltaWeeksFromPixels(deltaX, WEEK_WIDTH);
        targetStartIdx = clampStartIndex(origStartIdx, deltaWeeks, span, currentPlan.weeks.length);
        const effectiveDeltaWeeks = targetStartIdx - origStartIdx;
        bar.style.left = origStartIdx * WEEK_WIDTH + 4 + effectiveDeltaWeeks * WEEK_WIDTH + "px";
        if (contentEl) {
          const glyph = task.isSubtask ? "\u21B3" : "\u{1F537}";
          const sign = effectiveDeltaWeeks > 0 ? `+${effectiveDeltaWeeks}` : `${effectiveDeltaWeeks}`;
          contentEl.textContent = `${glyph} ${task.key} \u2794 ${currentPlan.weeks[targetStartIdx].weekKey} (${sign}w)`;
        }
      }
      async function onMouseUp() {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
        bar.classList.remove("is-dragging-active");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setTimeout(() => {
          isDraggingBar = false;
        }, 80);
        if (wasMoved && targetStartIdx !== origStartIdx) {
          const newStartWeek = currentPlan.weeks[targetStartIdx].weekKey;
          task.startWeek = newStartWeek;
          await callResolver("updateWbsTask", {
            taskId: task.key,
            updates: { startWeek: newStartWeek },
            expectedVersion: task.version || 0
          });
          await loadProjectPlan();
        } else {
          bar.style.left = origLeftPx + "px";
          if (contentEl) contentEl.textContent = origContentText;
        }
      }
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    });
  }
  function renderDependencySvgOverlay() {
    const svg = document.getElementById("dependencySvgLayer");
    if (!svg) return;
    svg.innerHTML = "";
    if (!currentPlan || !currentPlan.tasks) return;
    const ganttWrapper = document.getElementById("ganttWrapper");
    if (!ganttWrapper) return;
    const wrapperRect = ganttWrapper.getBoundingClientRect();
    const scrollWidth = Math.max(ganttWrapper.scrollWidth, 1200);
    const scrollHeight = Math.max(ganttWrapper.scrollHeight, 600);
    svg.setAttribute("width", scrollWidth);
    svg.setAttribute("height", scrollHeight);
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = html`
    <marker id="dep-arrow-success" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#36B37E" />
    </marker>
    <marker id="dep-arrow-violated" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#DE350B" />
    </marker>
    <marker id="dep-arrow-incoming" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#0052CC" />
    </marker>
    <marker id="dep-arrow-outgoing" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#FF8B00" />
    </marker>
  `;
    svg.appendChild(defs);
    const activeKey = hoveredTaskId || pinnedDependencyTaskId;
    document.querySelectorAll(".gantt-bar").forEach((b) => {
      b.classList.remove("highlight-dependency-active", "highlight-dependency-pred", "highlight-dependency-succ");
    });
    if (activeKey) {
      const activeBar = document.querySelector(`.gantt-bar[data-task-id="${activeKey}"]`);
      if (activeBar) {
        activeBar.classList.add("highlight-dependency-active");
      }
    }
    currentPlan.tasks.forEach((task) => {
      if (!task.dependency || !task.dependency.predecessorKey) return;
      const predTask = currentPlan.tasks.find((t) => t.key === task.dependency.predecessorKey);
      if (!predTask) return;
      const predBar = document.querySelector(`.gantt-bar[data-task-id="${predTask.key}"]`);
      const succBar = document.querySelector(`.gantt-bar[data-task-id="${task.key}"]`);
      if (!predBar || !succBar) return;
      const isIncoming = task.key === activeKey;
      const isOutgoing = predTask.key === activeKey;
      const isConnected = isIncoming || isOutgoing;
      if (activeKey) {
        if (isIncoming) {
          predBar.classList.add("highlight-dependency-pred");
        } else if (isOutgoing) {
          succBar.classList.add("highlight-dependency-succ");
        }
      }
      const predRect = predBar.getBoundingClientRect();
      const succRect = succBar.getBoundingClientRect();
      const triggerPct = (typeof task.dependency.triggerPercent === "number" ? task.dependency.triggerPercent : 30) / 100;
      const x1 = predRect.left - wrapperRect.left + ganttWrapper.scrollLeft + predRect.width * triggerPct;
      const y1 = predRect.top - wrapperRect.top + ganttWrapper.scrollTop + predRect.height / 2;
      const x2 = succRect.left - wrapperRect.left + ganttWrapper.scrollLeft;
      const y2 = succRect.top - wrapperRect.top + ganttWrapper.scrollTop + succRect.height / 2;
      const isViolated = Boolean(task.dependency.isViolated || x2 < x1);
      const dx = Math.max(35, Math.abs(x2 - x1) / 2);
      const pathData = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      let curveClass = "dep-path";
      let curveColor = isViolated ? "#DE350B" : "#36B37E";
      let markerEnd = isViolated ? "url(#dep-arrow-violated)" : "url(#dep-arrow-success)";
      if (activeKey) {
        if (isConnected) {
          curveClass = "dep-path active-dep" + (isViolated ? " violated" : "");
          if (isIncoming) {
            curveColor = isViolated ? "#DE350B" : "#0052CC";
            markerEnd = isViolated ? "url(#dep-arrow-violated)" : "url(#dep-arrow-incoming)";
          } else {
            curveColor = isViolated ? "#DE350B" : "#FF8B00";
            markerEnd = isViolated ? "url(#dep-arrow-violated)" : "url(#dep-arrow-outgoing)";
          }
        } else {
          curveClass = "dep-path dimmed-dep";
          curveColor = "#8993A4";
        }
      } else if (isViolated) {
        curveClass = "dep-path violated";
      }
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathData);
      path.setAttribute("class", curveClass);
      if (markerEnd && (!activeKey || isConnected)) {
        path.setAttribute("marker-end", markerEnd);
      }
      if (activeKey && isConnected) {
        path.style.stroke = curveColor;
      }
      svg.appendChild(path);
      if (!activeKey || isConnected) {
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x1);
        circle.setAttribute("cy", y1);
        circle.setAttribute("r", isConnected ? 5.5 : 4);
        circle.setAttribute("fill", curveColor);
        svg.appendChild(circle);
        const labelText = isConnected ? isIncoming ? `\u{1F517} ${task.key} depends on ${predTask.key} (${task.dependency.triggerPercent}% lag)` : `\u2794 ${task.key} depends on ${predTask.key} (${task.dependency.triggerPercent}% lag)` : isViolated ? `\u26A0 ${task.key} \u2794 ${predTask.key} (Lag violated)` : `${task.key} \u2794 ${predTask.key} (${task.dependency.triggerPercent}%)`;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const badgeW = Math.max(76, labelText.length * 6.5 + 20);
        const badgeH = 20;
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        rect.setAttribute("x", midX - badgeW / 2);
        rect.setAttribute("y", midY - badgeH / 2);
        rect.setAttribute("width", badgeW);
        rect.setAttribute("height", badgeH);
        rect.setAttribute("rx", 10);
        rect.setAttribute("ry", 10);
        rect.setAttribute("fill", curveColor);
        rect.style.filter = "drop-shadow(0 2px 4px rgba(9, 30, 66, 0.28))";
        g.appendChild(rect);
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", midX);
        text.setAttribute("y", midY);
        text.setAttribute("class", "dep-badge-text");
        text.textContent = labelText;
        g.appendChild(text);
        svg.appendChild(g);
      }
    });
  }
  function showTaskTooltip(e, task) {
    const tip = document.getElementById("globalTooltip");
    const isEpic = task.isEpic || task.hierarchyLevel === 1;
    const isSub = task.isSubtask || task.hierarchyLevel === -1;
    const levelTitle = isEpic ? "\u{1F7EA} Epic Roadmap Level" : isSub ? "\u21B3 Subtask Execution Level" : "\u{1F537} Story / Task Plan Level";
    const depInfo = task.dependency ? html`<div style="margin-top:4px; color:${task.dependency.isViolated ? "#FF8F73" : "#79F2C0"};">🔗 Dep: ${task.dependency.predecessorKey} >= ${task.dependency.triggerPercent}% (${task.dependency.isViolated ? "VIOLATED" : "SATISFIED"})</div>` : "";
    const rollupInfo = isEpic && task.rollupStats ? html`<div style="color:#A5B4FC; font-weight:600;">Rollup: ${task.childrenCount || 0} child items | Total ${task.effortHours}h</div>` : "";
    const subInfo = !isEpic && task.subtasks && task.subtasks.length > 0 ? html`<div style="color:#B3BAC5;">Subtasks: ${task.subtasks.length} items (${task.effortHours}h total)</div>` : "";
    const contributing = getTaskContributingResources(task);
    let assigneeHtml = html`<div>${isEpic ? "Epic Lead" : "Assignee"}: ${task.resource || "Unassigned"}</div>`;
    if (contributing.length > 1) {
      assigneeHtml = html`<div>${isEpic ? "Epic Team" : "Team"}: <strong>${contributing.map((c) => c.name).join(", ")}</strong> (${contributing.length} resources)</div>`;
    } else if (contributing.length === 1 && !contributing[0].isParent) {
      assigneeHtml = html`<div>Assignee: <strong>${contributing[0].name}</strong> (via subtask)</div>`;
    }
    const siteUrl = getJiraBaseUrl();
    tip.innerHTML = html`
    <div style="font-size:10px; color:#A5B4FC; font-weight:700; margin-bottom:2px;">${levelTitle}</div>
    <div><strong><a href="${siteUrl}/browse/${task.key}" target="_blank" rel="noopener noreferrer" style="color:#FFF; text-decoration:underline;">${task.key} ↗</a>: ${task.summary}</strong></div>
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
      if (u.displayName === task.resource) opt.selected = true;
      assSelect.appendChild(opt);
    });
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
    document.getElementById("editEstimateUnitSelect").value = "HOURS";
    document.getElementById("editEstimateValueInput").value = task.effortHours || 0;
    document.getElementById("reconciledHoursBadge").textContent = `Total: ${task.effortHours || 0} hrs`;
    handleEstimateUnitChange();
    renderModalSubtasks(task);
    document.getElementById("taskDetailModal").style.display = "flex";
  }
  function renderModalSubtasks(task) {
    const list = document.getElementById("subtasksList");
    list.innerHTML = "";
    const subs = task.subtasks || [];
    if (subs.length === 0) {
      list.innerHTML = '<div style="font-size:11px; color:#626F86;">No subtasks added yet.</div>';
    } else {
      subs.forEach((s, idx) => {
        const item = document.createElement("div");
        item.style.display = "flex";
        item.style.justifyContent = "space-between";
        item.style.fontSize = "12px";
        item.innerHTML = html`<span>• ${s.summary}</span><span style="font-weight:700;">${s.normalizedHours}h</span>`;
        list.appendChild(item);
      });
    }
  }
  async function handleAddSubtask() {
    const summary = document.getElementById("newSubtaskSummary").value.trim();
    const hours = parseInt(document.getElementById("newSubtaskHours").value, 10) || 8;
    if (!summary || !activeTaskId) return;
    await callResolver("addSubtaskToTask", {
      parentTaskId: activeTaskId,
      subtask: { summary, estimateValue: hours, estimateUnit: "HOURS" },
      bufferType: document.getElementById("editBufferTypeSelect").value,
      bufferValue: parseFloat(document.getElementById("editBufferValueInput").value) || 0
    });
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
    const hours = parseInt(document.getElementById("multiResourceHours").value, 10) || 20;
    const statusEl = document.getElementById("multiResourceStatus");
    const addBtn = document.getElementById("btnAddResourceSubtaskBtn");
    if (addBtn) {
      addBtn.disabled = true;
      addBtn.textContent = "Allocating...";
    }
    try {
      const res = await callResolver("createSubtaskForResource", {
        parentTaskId: activeTaskId,
        assigneeAccountId,
        assigneeName,
        effortHours: hours
      });
      if (!res || res.success !== true) {
        if (statusEl) {
          statusEl.textContent = res && (res.message || res.error) || "Jira did not create the subtask.";
          statusEl.style.color = "#DE350B";
          statusEl.style.display = "block";
        }
      } else {
        if (statusEl) {
          statusEl.textContent = `\u2713 Created Jira subtask for ${assigneeName} (${hours}h)`;
          statusEl.style.color = "#006644";
          statusEl.style.display = "block";
        }
        await loadProjectPlan();
        const updated = currentPlan.tasks.find((t) => t.key === activeTaskId);
        if (updated) renderModalSubtasks(updated);
      }
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = err?.message || "Failed to allocate resource subtask.";
        statusEl.style.color = "#DE350B";
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
      await callResolver("unscheduleTask", { taskId: activeTaskId });
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
  function handleEstimateUnitChange() {
    const unit = document.getElementById("editEstimateUnitSelect").value;
    document.getElementById("rawEstimateGroup").style.display = unit === "TSHIRT" ? "none" : "block";
    document.getElementById("tshirtSizeGroup").style.display = unit === "TSHIRT" ? "block" : "none";
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
    if (unit === "HOURS") {
      const val = parseFloat(document.getElementById("editEstimateValueInput").value);
      if (!isNaN(val)) effortHours = val;
    } else if (unit === "STORY_POINTS") {
      const pts = parseFloat(document.getElementById("editEstimateValueInput").value);
      if (!isNaN(pts)) effortHours = pts * 8;
    } else if (unit === "TSHIRT") {
      const sz = document.getElementById("editTshirtSelect").value;
      const tshirtMap = { XS: 4, S: 8, M: 16, L: 32, XL: 64 };
      effortHours = tshirtMap[sz] || 16;
    }
    const curTask = (currentPlan?.tasks || []).find((t) => t.key === activeTaskId) || {};
    const updates = {};
    if (summary && summary !== curTask.summary) updates.summary = summary;
    if (resource !== (curTask.resource || "Unassigned")) {
      updates.resource = resource;
      if (resourceAccountId) updates.resourceAccountId = resourceAccountId;
    }
    if (status !== curTask.status) updates.status = status;
    if (effortHours !== void 0 && effortHours !== (curTask.effortHours || 0)) updates.effortHours = effortHours;
    const progInput = document.getElementById("editProgressInput");
    if (progInput && progInput.value !== "") {
      const prog = Math.max(0, Math.min(100, parseInt(progInput.value, 10)));
      if (!isNaN(prog) && (prog !== (curTask.progress || 0) || modalUseRollupProgressFlag)) {
        updates.progress = prog;
        updates.manualProgress = !modalUseRollupProgressFlag;
        const effectiveStatus = updates.status || curTask.status;
        if (prog === 100 && effectiveStatus !== "COMPLETED") {
          updates.status = "COMPLETED";
        } else if (prog > 0 && effectiveStatus === "NOT_STARTED") {
          updates.status = "IN_PROGRESS";
        }
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
    const btn = document.getElementById("btnSaveTaskModal");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Saving...";
    }
    try {
      const res = await callResolver("updateWbsTask", { taskId: activeTaskId, updates, expectedVersion: curTask.version || 0 });
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
      opt.textContent = `${ep.key}: ${ep.summary}`;
      epicSelect.appendChild(opt);
    });
    const assSelect = document.getElementById("createAssigneeSelect");
    assSelect.innerHTML = "";
    (currentPlan?.availableUsers || []).forEach((u) => {
      const opt = document.createElement("option");
      opt.value = u.displayName;
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
    const epic = document.getElementById("createEpicSelect").value || "Prerequisites";
    const resource = document.getElementById("createAssigneeSelect").value || "Unassigned";
    const parsedEffort = parseInt(document.getElementById("createEffortInput").value, 10);
    const effortHours = isNaN(parsedEffort) ? void 0 : parsedEffort;
    const startWeek = document.getElementById("createStartWeekSelect").value;
    const errEl = document.getElementById("createTaskError");
    if (!summary) {
      summaryInput.style.borderColor = "#DE350B";
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
      const res = await callResolver("createInlineTask", {
        summary,
        epic,
        resource,
        effortHours,
        startWeek,
        spanWeeks: 3
      });
      if (res && res.success === false) {
        if (errEl) {
          errEl.textContent = res.error || "Failed to create task in Jira.";
          errEl.style.display = "block";
        }
        return;
      }
      summaryInput.value = "";
      closeModal("createTaskModal");
      await loadProjectPlan();
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
      summaryInput.style.borderColor = "#DE350B";
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
      const res = await callResolver("createJiraEpic", { summary });
      if (res && res.success === false) {
        if (errEl) {
          errEl.textContent = res.error || "Failed to create epic in Jira.";
          errEl.style.display = "block";
        }
        return;
      }
      summaryInput.value = "";
      closeModal("createEpicModal");
      await loadProjectPlan();
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
    document.getElementById(id).style.display = "none";
  }
  async function renderUtilizationView() {
    const cont = document.getElementById("utilizationProfilesContent");
    cont.innerHTML = '<div style="color:#626F86;">Loading utilization profiles...</div>';
    const res = await callResolver("getPortfolioResourceHeatmap", {});
    if (!res || !res.rows) {
      cont.innerHTML = "<div>No resource allocation data available.</div>";
      return;
    }
    let markup = html`<div style="display:flex; flex-direction:column; gap:16px;">`;
    res.rows.forEach((r) => {
      markup = html`${markup}
      <div style="background:#FFF; border:1px solid #DCDFE4; border-radius:6px; padding:12px;">
        <div style="font-weight:700; font-size:13px; margin-bottom:4px;">👤 ${r.resourceName} <span style="font-weight:500; color:#626F86;">(${r.coe} • ${r.vertical})</span></div>
        <div style="display:flex; gap:6px; overflow-x:auto; margin-top:8px;">
    `;
      res.weeks.forEach((w) => {
        const pct = r.weeklyUtilization[w.weekKey] || 0;
        const bg = pct > 100 ? "#FFEBE6" : pct === 100 ? "#E3FCEF" : pct > 0 ? "#DEEBFF" : "#F4F5F7";
        const fg = pct > 100 ? "#BF2600" : pct === 100 ? "#006644" : pct > 0 ? "#0747A6" : "#626F86";
        markup = html`${markup}
        <div style="background:${bg}; color:${fg}; border-radius:4px; padding:4px 8px; text-align:center; min-width:60px;">
          <div style="font-size:10px; font-weight:600;">${w.weekKey}</div>
          <div style="font-size:12px; font-weight:700;">${pct}%</div>
        </div>
      `;
      });
      markup = html`${markup}</div></div>`;
    });
    markup = html`${markup}</div>`;
    cont.innerHTML = html`${markup}`;
  }
  async function renderHeatmapView() {
    const cont = document.getElementById("heatmapContent");
    cont.innerHTML = '<div style="color:#626F86;">Loading capacity heatmap...</div>';
    const res = await callResolver("getPortfolioResourceHeatmap", {});
    if (!res || !res.rows) {
      cont.innerHTML = "<div>No capacity data available.</div>";
      return;
    }
    let markup = html`<table class="heatmap-table"><thead><tr><th class="heatmap-th">Resource</th><th class="heatmap-th">COE</th><th class="heatmap-th">Vertical</th>`;
    res.weeks.forEach((w) => {
      markup = html`${markup}<th class="heatmap-th">${w.weekKey}</th>`;
    });
    markup = html`${markup}</tr></thead><tbody>`;
    res.rows.forEach((r) => {
      markup = html`${markup}<tr>
      <td class="heatmap-td" style="text-align:left; font-weight:700;">${r.resourceName}</td>
      <td class="heatmap-td" style="color:#626F86;">${r.coe}</td>
      <td class="heatmap-td" style="color:#626F86;">${r.vertical}</td>
    `;
      res.weeks.forEach((w) => {
        const pct = r.weeklyUtilization[w.weekKey] || 0;
        const bg = pct > 100 ? "#FFEBE6" : pct === 100 ? "#E3FCEF" : pct > 0 ? "#DEEBFF" : "#FFF0B3";
        const fg = pct > 100 ? "#BF2600" : pct === 100 ? "#006644" : pct > 0 ? "#0747A6" : "#172B4D";
        markup = html`${markup}<td class="heatmap-td" style="background:${bg}; color:${fg};">${pct}%</td>`;
      });
      markup = html`${markup}</tr>`;
    });
    markup = html`${markup}</tbody></table>`;
    cont.innerHTML = html`${markup}`;
  }
})();
