"use strict";

const Module = require("module");

const originalLoad = Module._load;

function installStubs(stubs) {
  Module._load = function (request) {
    if (Object.prototype.hasOwnProperty.call(stubs, request)) {
      return stubs[request];
    }
    return originalLoad.apply(this, arguments);
  };
}

function restoreStubs() {
  Module._load = originalLoad;
}

function createAxiosStub(routes) {
  const calls = [];
  const handle = async function (url, options) {
    calls.push({ url: url, options: options });
    for (let i = 0; i < routes.length; i++) {
      if (routes[i].match(url)) {
        return routes[i].respond(url, options);
      }
    }
    throw new Error("no stub route for " + url);
  };
  return {
    calls: calls,
    module: {
      create: function () {
        return { get: handle };
      },
      get: handle
    }
  };
}

function httpError(status, message) {
  const err = new Error(message || "Request failed with status code " + status);
  err.response = { status: status };
  return err;
}

module.exports = {
  installStubs,
  restoreStubs,
  createAxiosStub,
  httpError
};
