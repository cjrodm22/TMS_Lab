import cybersourceRestClient from "cybersource-rest-client";
import { cybsConfig } from "../config/cybs.config.js";

export function getCybsConfigObject() {
  return {
    authenticationType: cybsConfig.authenticationType,
    runEnvironment: cybsConfig.runEnvironment,
    merchantID: cybsConfig.merchantID,

    keyAlias: cybsConfig.keyAlias,
    keyPass: cybsConfig.keyPass,
    keyFileName: cybsConfig.keyFileName,
    keysDirectory: cybsConfig.keysDirectory,

    enableLog: cybsConfig.enableLog,
    logDirectory: cybsConfig.logDirectory,
    logFilename: cybsConfig.logFilename,
  };
}

export { cybersourceRestClient };
