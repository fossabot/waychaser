import fetch from "isomorphic-fetch";
import { polyfill } from "es6-promise";
import LinkHeader from "http-link-header";
import Loki from "lokijs";
import logger from "./util/logger";
polyfill();

/**
 * @param url
 * @param options
 */
function loadResource(url, options) {
  logger.waychaser(`loading ${url}`);
  return fetch(url, options).then((response) => {
    if (!response.ok) {
      logger.waychaser(`Bad response from server ${JSON.stringify(response)}`);
      throw new Error("Bad response from server", response);
    }
    logger.waychaser(`Good response from server ${JSON.stringify(response)}`);
    if (response.url === undefined || response.url === "") {
      // in ie url is not being populated 🤷‍♂️
      response.url = url;
    }
    return new waychaser.ApiResourceObject(response);
  });
}

class Operation {
  constructor(callingContext) {
    logger.waychaser(
      `Operation callingContext ${JSON.stringify(this.callingContext)}`
    );
    this.callingContext = callingContext;
  }

  async invoke(context, options) {
    logger.waychaser(`invoke`);
    //    logger.waychaser(this, context, options);
    const contextUrl = this.callingContext.url;
    logger.waychaser(`constext ${JSON.stringify(this.callingContext)}`);
    logger.waychaser(`constext ${this.callingContext.url}`);
    logger.waychaser(`constext ${contextUrl}`);
    const invokeUrl = new URL(this.uri, contextUrl);
    //    logger.waychaser({ invokeUrl });
    logger.waychaser(`invoking ${invokeUrl}`);
    return loadResource(invokeUrl, options);
  }
}
Loki.Collection.prototype.findOneByRel = function (relationship) {
  return this.findOne({ rel: relationship });
};

Loki.Collection.prototype.invokeByRel = async function (
  relationship,
  context,
  options
) {
  const operation = this.findOneByRel(relationship);
  logger.waychaser(JSON.stringify(operation, undefined, 2));
  return operation.invoke(context, options);
};

/** @namespace */
const waychaser = {
  /**
   * Loads an API
   *
   * @param {string} url - the URL of the API to load
   * @param {object} options - options to pass to fetch
   *
   * @returns {ApiResourceObject} a ApiResourceObject representing the loaded resource
   *
   * @throws {Error} If the server returns with a status >= 400
   */
  load: async function (url, options) {
    return loadResource(url, options);
  },

  logger: logger.waychaser,

  ApiResourceObject: class {
    constructor(response) {
      logger.waychaser("creating ARO", response);
      this.response = response;
      const linkHeader = response.headers.get("link");
      const linkDatabase = new Loki();
      this.operations = linkDatabase.addCollection();
      if (linkHeader) {
        const links = LinkHeader.parse(linkHeader);

        this.operations.insert(
          links.refs.map((reference) => {
            logger.waychaser({ reference });
            logger.waychaser(JSON.stringify(response));

            logger.waychaser("creating operation", response, reference);
            const operation = new Operation(response);
            logger.waychaser(JSON.stringify({ operation }));
            const operationX = Object.assign(operation, reference);
            logger.waychaser(JSON.stringify({ operation: operationX }));
            return operation;
          })
        );
      }
    }

    get ops() {
      return this.operations;
    }

    async invokeByRel(relationship) {
      return this.operations.invokeByRel(relationship);
    }
  },
};

export { waychaser };
