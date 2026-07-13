export var RuntimeStatus;
(function (RuntimeStatus) {
    RuntimeStatus["STOPPED"] = "stopped";
    RuntimeStatus["CHECKING"] = "checking";
    RuntimeStatus["LOADING_RUNTIME"] = "loading_runtime";
    RuntimeStatus["LOADING_PLUGINS"] = "loading_plugins";
    RuntimeStatus["LOADING_WORKSPACE"] = "loading_workspace";
    RuntimeStatus["LOADING_AGENTS"] = "loading_agents";
    RuntimeStatus["RUNNING"] = "running";
    RuntimeStatus["STOPPING"] = "stopping";
    RuntimeStatus["ERROR"] = "error";
})(RuntimeStatus || (RuntimeStatus = {}));
export var LogLevel;
(function (LogLevel) {
    LogLevel["ERROR"] = "error";
    LogLevel["WARN"] = "warn";
    LogLevel["INFO"] = "info";
    LogLevel["DEBUG"] = "debug";
})(LogLevel || (LogLevel = {}));
//# sourceMappingURL=types.js.map