import { Given } from '@cucumber/cucumber'
import LinkHeader from 'http-link-header'
import { API_ACCESS_HOST, API_ACCESS_PORT } from './config'

import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals
} from 'unique-names-generator'
import logger from '../util/logger'

let pathCount = 0

const randomApiPath = () => {
  return `/api/${pathCount++}-${uniqueNamesGenerator({
    dictionaries: [adjectives, colors, animals]
  })}`
}

function createLinks (relationship, uri) {
  const links = new LinkHeader()
  links.set({
    rel: relationship,
    uri: uri
  })
  return links
}

function sendResponse (response, status, links, linkTemplates) {
  if (links) {
    response.header('link', links.toString())
  }
  if (linkTemplates) {
    response.header('link-template', linkTemplates.toString())
  }
  response.status(status).send({ status })
}

function filterParameters (parameters, type) {
  return parameters.filter(parameter_ => {
    return parameter_.TYPE === type
  })
}

function joinParameters (parameters, separator) {
  return parameters
    .map(parameter_ => {
      return parameter_.NAME
    })
    .join(separator)
}

async function createDynamicResourceRoute (
  rootRouter,
  route,
  relationship,
  method,
  parameter,
  parameterType,
  contentTypes,
  parameters
) {
  let dynamicRoutePath = route
  if (parameterType === 'path') {
    dynamicRoutePath = `${route}/:${parameter}`
  }
  let dynamicUri = route
  if (parameterType === 'query') {
    dynamicUri = `${route}{?${parameter}}`
  } else if (parameterType === 'path') {
    dynamicUri = `${route}{/${parameter}}`
  } else if (parameters) {
    // {/who,dub}
    const pathParameters = filterParameters(parameters, 'path')
    if (pathParameters.length > 0) {
      dynamicUri += `{/${joinParameters(pathParameters)}}`
      dynamicRoutePath += `/:${joinParameters(pathParameters, '/:')}`
    }
    // {?x,y}
    const queryParameters = filterParameters(parameters, 'query')
    if (queryParameters.length > 0) {
      dynamicUri += `{?${joinParameters(queryParameters)}}`
    }
  }
  const dynamicRoute = await rootRouter.route(dynamicRoutePath)
  await dynamicRoute[method.toLowerCase()](async (request, response) => {
    // logger.debug('SENDING', method, route, { ...request.query })
    logger.debug('RECEIVED BODY', method, route, { ...request.body })
    const responseBody = Object.assign(
      {},
      request.body,
      request.query,
      request.params
    )
    if (contentTypes !== undefined) {
      if (request.headers['content-type'].startsWith('multipart/form-data')) {
        responseBody['content-type'] = 'multipart/form-data'
      } else {
        responseBody['content-type'] = request.headers['content-type']
      }
    }
    response.status(200).send(responseBody)
  })

  const acceptArray = Array.isArray(contentTypes)
    ? contentTypes
    : [contentTypes]
  const accept =
    acceptArray.length === 0 ||
    // the default is application/x-www-form-urlencoded, so don't send it if that's what it's set to
    (acceptArray.length === 1 && acceptArray[0]) ===
      'application/x-www-form-urlencoded'
      ? undefined
      : acceptArray.join()
  const links = new LinkHeader()
  links.set({
    rel: relationship,
    uri: dynamicUri,
    method: method,
    ...(parameterType === 'body' && {
      'params*': { value: JSON.stringify({ [parameter]: {} }) }
    }),
    ...(accept && {
      'accept*': { value: accept }
    })
  })

  const currentResourceRoute = randomApiPath()
  await createOkRouteWithLinks(
    rootRouter,
    currentResourceRoute,
    undefined,
    links
  )
  return currentResourceRoute
}

async function createRouteWithLinks (
  rootRouter,
  route,
  status,
  links,
  linkTemplates
) {
  const router = await rootRouter.route(route)
  await router.get(async (request, response) => {
    sendResponse(response, status, links, linkTemplates)
  })
  return router
}

async function createOkRouteWithLinks (
  rootRouter,
  route,
  links,
  linkTemplates
) {
  return createRouteWithLinks(rootRouter, route, 200, links, linkTemplates)
}

Given('a resource returning status code {int}', async function (status) {
  this.currentResourceRoute = randomApiPath()
  await createRouteWithLinks(this.router, this.currentResourceRoute, status)
  this.firstResourceRoute = `http://${API_ACCESS_HOST}:${API_ACCESS_PORT}${this.currentResourceRoute}`
})

Given('a resource with no operations', async function () {
  this.currentResourceRoute = randomApiPath()
  await createOkRouteWithLinks(this.router, this.currentResourceRoute)
})

Given('a resource with a {string} operation', async function (relationship) {
  this.currentResourceRoute = randomApiPath()
  await createOkRouteWithLinks(
    this.router,
    this.currentResourceRoute,
    createLinks(relationship)
  )
})

Given(
  'a resource with a {string} operation that returns itself',
  async function (relationship) {
    this.currentResourceRoute = randomApiPath()
    const to = this.currentResourceRoute
    await createOkRouteWithLinks(
      this.router,
      this.currentResourceRoute,
      createLinks(relationship, to)
    )
  }
)

Given(
  'a resource with a {string} operation that returns an error',
  async function (relationship) {
    this.currentResourceRoute = randomApiPath()
    const to = `http://${API_ACCESS_HOST}:33556/api`
    await createOkRouteWithLinks(
      this.router,
      this.currentResourceRoute,
      createLinks(relationship, to)
    )
  }
)

Given(
  'a resource with a {string} operation that returns that resource',
  async function (relationship) {
    const previousResourceRoute = this.currentResourceRoute
    this.currentResourceRoute = randomApiPath()
    await createOkRouteWithLinks(
      this.router,
      this.currentResourceRoute,
      createLinks(relationship, previousResourceRoute)
    )
  }
)

Given(
  'a list of {int} resources linked with {string} operations',
  async function (count, relationship) {
    // we add the last one first
    this.currentResourceRoute = randomApiPath()
    await createOkRouteWithLinks(this.router, this.currentResourceRoute)
    this.lastOnList = `http://${API_ACCESS_HOST}:${API_ACCESS_PORT}${this.currentResourceRoute}`
    for (let index = 1; index < count; index++) {
      // and then point each on to the previously created resource
      const previousResourceRoute = this.currentResourceRoute
      this.currentResourceRoute = randomApiPath()
      await createOkRouteWithLinks(
        this.router,
        this.currentResourceRoute,
        createLinks(relationship, previousResourceRoute)
      )
    }
    // POST: this.currentResourceRoute points to the first resource in the list
  }
)

Given(
  'a resource with a {string} operation that returns the provided {string} {string} parameter',
  async function (relationship, parameter, parameterType) {
    this.currentResourceRoute = await createDynamicResourceRoute(
      this.router,
      randomApiPath(),
      relationship,
      'GET',
      parameter,
      parameterType
    )
  }
)

Given(
  'a resource with a {string} operation with the {string} method returning status code {int}',
  async function (relationship, method, statusCode) {
    this.currentResourceRoute = randomApiPath()
    const links = new LinkHeader()
    links.set({
      rel: relationship,
      uri: this.currentResourceRoute,
      method
    })
    await createOkRouteWithLinks(
      this.router,
      this.currentResourceRoute,
      undefined,
      links
    ).then(route => {
      route[method.toLowerCase()](async (request, response) => {
        sendResponse(response, statusCode)
      })
    })
  }
)

Given(
  'a resource with a {string} operation with the {string} method that returns the provided {string} {string} parameter',
  async function (relationship, method, parameter, parameterType) {
    this.currentResourceRoute = await createDynamicResourceRoute(
      this.router,
      randomApiPath(),
      relationship,
      method,
      parameter,
      parameterType
    )
  }
)

Given(
  'a resource with a {string} operation with the {string} method that returns the {string} provided {string} {string} parameter and the content type',
  async function (relationship, method, contentType, parameter, parameterType) {
    this.currentResourceRoute = await createDynamicResourceRoute(
      this.router,
      randomApiPath(),
      relationship,
      method,
      parameter,
      parameterType,
      contentType
    )
  }
)

Given(
  'a resource with a {string} operation with the {string} method that returns the provided {string} {string} parameter and the content type, accepting:',
  async function (
    relationship,
    method,
    parameter,
    parameterType,
    contentTypes
  ) {
    this.currentResourceRoute = await createDynamicResourceRoute(
      this.router,
      randomApiPath(),
      relationship,
      method,
      parameter,
      parameterType,
      contentTypes.rows()
    )
  }
)

Given(
  'a resource with a {string} operation with the {string} method that returns the following provided parameters',
  async function (relationship, method, dataTable) {
    const parameters = dataTable.hashes()
    this.currentResourceRoute = await createDynamicResourceRoute(
      this.router,
      randomApiPath(),
      relationship,
      method,
      undefined,
      undefined,
      undefined,
      parameters
    )
  }
)
