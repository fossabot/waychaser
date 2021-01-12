import fetch from 'isomorphic-fetch'
import { polyfill } from 'es6-promise'
import LinkHeader from 'http-link-header'
import Loki from 'lokijs'
import logger from './util/logger'
import { URI } from 'uri-template-lite'
import qsStringify from 'qs-stringify'
import Accept from '@hapi/accept'
import FormData from 'form-data'
polyfill()

/**
 * Loads the resouce at the provided url using fetch
 *
 * @param {URL} url url of the resource to load
 * @param {object} options options to pass to fetch
 *
 * @returns {waychaser.ApiResourceObject} a ApiResourceObject representing the loaded resource
 *
 * @throws {Error} If the server returns with a status >= 400
 */
async function loadResource (url, options) {
  logger.waychaser(`loading ${url} with:`)
  logger.waychaser(JSON.stringify(options, undefined, 2))
  const response = await fetch(url, options)
  if (!response.ok) {
    logger.waychaser(`Bad response from server ${JSON.stringify(response)}`)
    throw new Error('Bad response from server', response)
  }
  logger.waychaser(
    `Good response from server ${JSON.stringify(
      response
    )}, ${response.headers.get('content-type')}`
  )
  /* istanbul ignore next: IE fails without this, but IE doesn't report coverage */
  if (response.url === undefined || response.url === '') {
    // in ie url is not being populated 🤷‍♂️
    response.url = url.toString()
  }
  const contentType = response.headers.get('content-type')?.split(';')
  if (contentType?.[0] === 'application/hal+json') {
    // only consume the body if the content type tells us that the response body will have operations
    const body = await response.json()
    return new waychaser.ApiResourceObject(response, body, contentType[0])
  } else {
    return new waychaser.ApiResourceObject(response)
  }
}
/**
 * @param {Loki.Collection} operations the target loki collection to load the operations into
 * @param {LinkHeader} links the links to load
 * @param {fetch.Response} callingContext the reponse object that the {@param links} are relative to.
 */
function addLinksToOperations (operations, links, callingContext) {
  operations.insert(
    links.refs.map(reference => {
      const operation = new Operation(callingContext)
      Object.assign(operation, reference)
      return operation
    })
  )
}

/**
 * Creates operations from each linkHeader and inserts into the operations collection
 *
 * @param {Loki.Collection} operations the target loki collection to load the operations into
 * @param {string} linkHeader the link header to load the operations from
 * @param {fetch.Response} callingContext the reponse object that the links in link header are relative to.
 */
function loadOperations (operations, linkHeader, callingContext) {
  if (linkHeader) {
    const links = LinkHeader.parse(linkHeader)
    addLinksToOperations(operations, links, callingContext)
  }
}

/**
 * Creates operations from each link in a HAL `_links` and inserts into the operations collection
 *
 * @param {Loki.Collection} operations the target loki collection to load the operations into
 * @param {object} _links HAL links within the response
 * @param {fetch.Response} callingContext the reponse object that the links in link header are relative to.
 */
function loadHalOperations (operations, _links, callingContext) {
  const links = new LinkHeader()
  Object.keys(_links).forEach(key => {
    links.set({
      rel: key,
      uri: _links[key].href
    })
  })

  addLinksToOperations(operations, links, callingContext)
}

class Operation {
  constructor (callingContext) {
    logger.waychaser(
      `Operation callingContext ${JSON.stringify(this.callingContext)}`
    )
    this.callingContext = callingContext
  }

  async invoke (context, options) {
    const parameters = this['params*']?.value
      ? JSON.parse(this['params*']?.value)
      : {}
    logger.waychaser(parameters)
    const contextUrl = this.callingContext.url
    const expandedUri = URI.expand(this.uri, context || {})
    logger.waychaser(`loading ${expandedUri}`)

    const invokeUrl = new URL(expandedUri, contextUrl)
    const body = {}
    Object.keys(parameters).forEach(key => {
      body[key] = context[key]
    })
    logger.waychaser(
      `invoking ${invokeUrl} with body ${
        this['params*']?.value ? JSON.stringify(body) : undefined
      }`
    )
    const contentType = Accept.mediaType(
      this['accept*']?.value || 'application/x-www-form-urlencoded',
      [
        'application/x-www-form-urlencoded',
        'application/json',
        'multipart/form-data'
      ]
    )
    let encodedContent
    switch (contentType) {
      case 'application/x-www-form-urlencoded':
        encodedContent = qsStringify(body)
        break
      case 'application/json':
        encodedContent = JSON.stringify(body)
        break
      case 'multipart/form-data':
        encodedContent = new FormData()
        for (const name in body) {
          encodedContent.append(name, body[name])
        }
        break
    }
    let headers
    if (this['params*']?.value && contentType !== 'multipart/form-data') {
      headers = {
        'Content-Type': contentType
      }
    }

    return loadResource(
      invokeUrl,
      Object.assign(
        {
          method: this.method,
          headers,
          ...(this['params*']?.value && {
            body: encodedContent
          })
        },
        options
      )
    )
  }
}

Loki.Collection.prototype.findOne_ = Loki.Collection.prototype.findOne

Loki.Collection.prototype.findOne = function (...arguments_) {
  return arguments_.length === 1 && typeof arguments_[0] === 'string'
    ? this.findOne_({ rel: arguments_[0] })
    : this.findOne_(...arguments_)
}

Loki.Collection.prototype.invoke = async function (
  relationship,
  context,
  options
) {
  const operation = this.findOne(relationship)
  logger.waychaser(
    `operation ${relationship}:`,
    JSON.stringify(operation, undefined, 2)
  )
  logger.waychaser('context:', JSON.stringify(context, undefined, 2))
  return operation.invoke(context, options)
}

/** @namespace */
const waychaser = {
  /**
   * Loads an API
   *
   * @param {URL} url - the URL of the API to load
   * @param {object} options - options to pass to fetch
   *
   * @returns {waychaser.ApiResourceObject} a ApiResourceObject representing the loaded resource
   *
   * @throws {Error} If the server returns with a status >= 400
   */
  load: async function (url, options) {
    return loadResource(url, options)
  },

  logger: logger.waychaser,

  ApiResourceObject: class {
    constructor (response, body, contentType) {
      this.response = response
      this._body = body
      const linkHeader = response.headers.get('link')
      const linkTemplateHeader = response.headers.get('link-template')
      const linkDatabase = new Loki()
      this.operations = linkDatabase.addCollection()
      loadOperations(this.operations, linkHeader, response)
      loadOperations(this.operations, linkTemplateHeader, response)
      if (contentType === 'application/hal+json') {
        loadHalOperations(this.operations, body._links, response)
      }
    }

    get ops () {
      return this.operations
    }

    async invoke (relationship, context) {
      return this.operations.invoke(relationship, context)
    }

    async body () {
      if (!this.response.bodyUsed) {
        this._body = await this.response.json()
      }
      return this._body
    }
  }
}

export { waychaser }
